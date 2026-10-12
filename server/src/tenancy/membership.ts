/**
 * Memberships
 * A user's place, and role, in an organization.
 */

import { Role } from '@prisma/client';
import { prisma } from '@/database/client';

/**
 * Make sure a user belongs to an organization. An existing membership keeps
 * its role unless `role` is given.
 */
export async function ensureMembership(organizationId: string, userId: string, role?: Role) {
  return prisma.membership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, role: role ?? Role.MEMBER },
    update: role ? { role } : {},
  });
}

/**
 * Whether a user belongs to an organization
 */
export async function isMemberOf(organizationId: string, userId: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true },
  });
  return membership !== null;
}
