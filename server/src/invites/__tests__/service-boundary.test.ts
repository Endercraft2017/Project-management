import { Role, InviteStatus } from '@prisma/client';
import { createInvite, listInvites, revokeInvite } from '../service';
import prisma from '@/database/client';
import { createMemberInvitation, revokeMemberInvitation } from '@/platform/store';

jest.mock('@/database/client', () => ({ __esModule: true, default: { teamInvite: { findMany: jest.fn() } } }));
jest.mock('@/tenancy/context', () => ({ getTenantContext: () => ({ id: 'tenant-id', code: 'A0000Z' }) }));
jest.mock('@/platform/store', () => ({ createMemberInvitation: jest.fn(), revokeMemberInvitation: jest.fn() }));

const invite = {
  id: 'invite-id', email: 'person@customer.example', role: Role.MEMBER,
  status: InviteStatus.PENDING, expiresAt: new Date('2099-01-01'), createdAt: new Date('2026-01-01'),
};

describe('tenant invitation service boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the resolved tenant and returns only the one-use URL plus safe metadata', async () => {
    (createMemberInvitation as jest.Mock).mockResolvedValue({
      setupToken: 'synthetic-token', invite: { ...invite, token: 'stored-digest', passwordHash: 'synthetic' },
    });
    const result = await createInvite(invite.email, Role.MEMBER, 'admin-id');
    expect(createMemberInvitation).toHaveBeenCalledWith({ tenantId: 'tenant-id', email: invite.email, name: 'person', role: Role.MEMBER, actorId: 'admin-id' });
    expect(result).toEqual({ ...invite, setupUrl: '/activate?tenantCode=A0000Z&token=synthetic-token' });
  });

  it('selects a bounded safe list without stored token digests', async () => {
    (prisma.teamInvite.findMany as jest.Mock).mockResolvedValue([invite]);
    expect(await listInvites({ email: 'customer.example', status: InviteStatus.PENDING })).toEqual([invite]);
    const options = (prisma.teamInvite.findMany as jest.Mock).mock.calls[0][0];
    expect(options.take).toBe(200);
    expect(options.select).not.toHaveProperty('token');
    expect(options.where.email).toEqual({ contains: 'customer.example', mode: 'insensitive' });
  });

  it('reports elapsed pending invitations as expired', async () => {
    (prisma.teamInvite.findMany as jest.Mock).mockResolvedValue([{ ...invite, expiresAt: new Date('2000-01-01') }]);
    expect((await listInvites())[0].status).toBe(InviteStatus.EXPIRED);
  });

  it('revokes only in the resolved tenant with the authenticated actor', async () => {
    await revokeInvite('invite-id', 'admin-id');
    expect(revokeMemberInvitation).toHaveBeenCalledWith({ tenantId: 'tenant-id', inviteId: 'invite-id', actorId: 'admin-id' });
  });
});
