import { InviteStatus, Role } from '@prisma/client';
import prisma from '@/database/client';
import { getTenantContext } from '@/tenancy/context';
import { createMemberInvitation, revokeMemberInvitation } from '@/platform/store';

const publicInvite = {
  id: true, email: true, role: true, status: true, expiresAt: true,
  createdAt: true, acceptedAt: true,
  invitedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function createInvite(email: string, role: Role, invitedById: string, name?: string) {
  const tenant = getTenantContext();
  const result = await createMemberInvitation({
    tenantId: tenant.id, email, name: name || email.split('@')[0], role, actorId: invitedById,
  });
  const query = new URLSearchParams({ tenantCode: tenant.code, token: result.setupToken });
  const invite = result.invite;
  return {
    id: invite.id, email: invite.email, role: invite.role, status: invite.status,
    expiresAt: invite.expiresAt, createdAt: invite.createdAt,
    setupUrl: `/activate?${query.toString()}`,
  };
}

export async function listInvites(filters: { status?: InviteStatus; email?: string } = {}) {
  const where: any = {};
  const now = new Date();
  if (filters.status === InviteStatus.EXPIRED) {
    where.OR = [{ status: InviteStatus.EXPIRED }, { status: InviteStatus.PENDING, expiresAt: { lte: now } }];
  } else if (filters.status) {
    where.status = filters.status;
    if (filters.status === InviteStatus.PENDING) where.expiresAt = { gt: now };
  }
  if (filters.email) where.email = { contains: filters.email, mode: 'insensitive' };
  const rows = await prisma.teamInvite.findMany({ where, select: publicInvite, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((row) => ({ ...row, status: row.status === InviteStatus.PENDING && row.expiresAt <= now ? InviteStatus.EXPIRED : row.status }));
}

export async function revokeInvite(inviteId: string, actorId: string) {
  return revokeMemberInvitation({ tenantId: getTenantContext().id, inviteId, actorId });
}
