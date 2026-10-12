/**
 * Team Invitation Service
 * Handles creating, accepting, and managing team invitations
 */

import prisma from '@/database/client';
import { sendInvitationEmail } from '@/lib/email';
import { normalizeEmail, isValidDomain } from '@/lib/email-utils';
import { InviteStatus, Role } from '@prisma/client';
import crypto from 'crypto';

/**
 * Create a new team invitation
 */
export async function createInvite(
  email: string,
  role: Role,
  invitedById: string
): Promise<{
  id: string;
  email: string;
  token: string;
  role: Role;
  status: InviteStatus;
  expiresAt: Date;
  createdAt: Date;
}> {
  // Normalize email to lowercase for consistent storage and comparison
  const normalizedEmail = normalizeEmail(email);

  // Validate email domain
  if (!isValidDomain(normalizedEmail)) {
    throw new Error('Only @servicebay.ai email addresses are allowed');
  }

  // Check if user already exists (case-insensitive)
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (existingUser && existingUser.isActive) {
    // If user exists and is active, they're already a member
    throw new Error('User with this email already exists');
  }

  // User either doesn't exist, or exists but is inactive
  // In both cases, create a pending invitation that requires acceptance

  // Check for existing pending invite (case-insensitive)
  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
      status: InviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvite) {
    throw new Error('An active invitation already exists for this email');
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');

  // Set expiry to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create invitation
  const invite = await prisma.teamInvite.create({
    data: {
      email: normalizedEmail,
      token,
      role,
      invitedById,
      expiresAt,
    },
    include: {
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  // Send invitation email
  try {
    await sendInvitationEmail(normalizedEmail, invite.invitedBy.name, token, role);
  } catch (error) {
    console.error('[Invites] Failed to send invitation email:', error);
    // Don't fail the invitation creation if email fails
    // The invite can still be resent manually
  }

  console.log(`[Invites] Created invitation for ${normalizedEmail} by ${invite.invitedBy.name}`);

  return {
    id: invite.id,
    email: invite.email,
    token: invite.token,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

/**
 * Accept a team invitation and create user account
 */
export async function acceptInvite(
  token: string,
  userData: {
    name: string;
    googleId?: string;
    picture?: string;
  }
): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
  invite: {
    id: string;
    acceptedAt: Date;
  };
}> {
  // Find invitation by token
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      invitedBy: {
        select: { name: true },
      },
    },
  });

  if (!invite) {
    throw new Error('Invalid invitation token');
  }

  // Check if already accepted
  if (invite.status !== InviteStatus.PENDING) {
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new Error('This invitation has already been accepted');
    } else if (invite.status === InviteStatus.REVOKED) {
      throw new Error('This invitation has been revoked');
    } else if (invite.status === InviteStatus.EXPIRED) {
      throw new Error('This invitation has expired');
    }
  }

  // Check if expired
  if (invite.expiresAt < new Date()) {
    // Mark as expired
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.EXPIRED },
    });

    throw new Error('This invitation has expired');
  }

  // Normalize the invite email for consistent comparison
  const normalizedInviteEmail = normalizeEmail(invite.email);

  // Check if user already exists (shouldn't happen, but double-check)
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedInviteEmail,
        mode: 'insensitive',
      },
    },
  });

  if (existingUser) {
    throw new Error('User account already exists for this email');
  }

  // Create user account and mark invite as accepted in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user with normalized email
    const user = await tx.user.create({
      data: {
        email: normalizedInviteEmail,
        name: userData.name,
        picture: userData.picture,
        role: invite.role,
        isActive: true,
      },
    });

    // Join the inviting organization with the invited role
    await tx.membership.create({
      data: {
        organizationId: invite.organizationId,
        userId: user.id,
        role: invite.role,
      },
    });

    // Mark invitation as accepted
    const updatedInvite = await tx.teamInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    return { user, invite: updatedInvite };
  });

  console.log(`[Invites] User ${result.user.email} accepted invitation and account created`);

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    },
    invite: {
      id: result.invite.id,
      acceptedAt: result.invite.acceptedAt!,
    },
  };
}

/**
 * List invitations with optional filters
 */
export async function listInvites(filters?: {
  status?: InviteStatus;
  email?: string;
}): Promise<
  Array<{
    id: string;
    email: string;
    role: Role;
    status: InviteStatus;
    invitedBy: { name: string; email: string };
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
  }>
> {
  const where: any = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }

  const invites = await prisma.teamInvite.findMany({
    where,
    include: {
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invites;
}

/**
 * Revoke a pending invitation
 */
export async function revokeInvite(inviteId: string, revokedById: string): Promise<void> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    throw new Error('Invitation not found');
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new Error('Only pending invitations can be revoked');
  }

  await prisma.teamInvite.update({
    where: { id: inviteId },
    data: { status: InviteStatus.REVOKED },
  });

  console.log(`[Invites] Invitation ${inviteId} revoked by user ${revokedById}`);
}

/**
 * Resend invitation email
 */
export async function resendInvite(inviteId: string): Promise<void> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: {
      invitedBy: {
        select: { name: true },
      },
    },
  });

  if (!invite) {
    throw new Error('Invitation not found');
  }

  if (invite.status !== InviteStatus.PENDING) {
    throw new Error('Only pending invitations can be resent');
  }

  if (invite.expiresAt < new Date()) {
    throw new Error('Invitation has expired and cannot be resent');
  }

  // Resend email
  await sendInvitationEmail(invite.email, invite.invitedBy.name, invite.token, invite.role);

  console.log(`[Invites] Resent invitation email to ${invite.email}`);
}

/**
 * Get invitation by token (for validation)
 */
export async function getInviteByToken(
  token: string
): Promise<{
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  invitedBy: { name: string };
  expiresAt: Date;
  isValid: boolean;
} | null> {
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      invitedBy: {
        select: { name: true },
      },
    },
  });

  if (!invite) {
    return null;
  }

  const isValid =
    invite.status === InviteStatus.PENDING && invite.expiresAt > new Date();

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
    isValid,
  };
}

/**
 * Cleanup expired invitations (background job)
 */
export async function cleanupExpiredInvites(): Promise<number> {
  const result = await prisma.teamInvite.updateMany({
    where: {
      status: InviteStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: {
      status: InviteStatus.EXPIRED,
    },
  });

  if (result.count > 0) {
    console.log(`[Invites] Marked ${result.count} expired invitations`);
  }

  return result.count;
}

export default {
  createInvite,
  acceptInvite,
  listInvites,
  revokeInvite,
  resendInvite,
  getInviteByToken,
  cleanupExpiredInvites,
};
