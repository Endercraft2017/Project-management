/**
 * Invitation Validators
 * Zod schemas for request validation
 */

import { z } from 'zod';
import { Role, InviteStatus } from '@prisma/client';
import { normalizeEmail, isValidDomain } from '@/lib/email-utils';

/**
 * Send invitation request body
 */
export const sendInviteSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .transform((email) => normalizeEmail(email))
    .refine((email) => isValidDomain(email), {
      message: 'Only @servicebay.ai email addresses are allowed',
    }),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be either ADMIN or MEMBER' }),
  }),
});

export type SendInviteInput = z.infer<typeof sendInviteSchema>;

/**
 * Accept invitation request body
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  googleId: z.string().optional(),
  picture: z.string().url('Invalid picture URL').optional(),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/**
 * List invitations query params
 */
export const listInvitesQuerySchema = z.object({
  status: z.nativeEnum(InviteStatus).optional(),
  email: z.string().optional(),
});

export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;

/**
 * Revoke invitation params
 */
export const revokeInviteParamsSchema = z.object({
  id: z.string().uuid('Invalid invitation ID'),
});

export type RevokeInviteParams = z.infer<typeof revokeInviteParamsSchema>;

/**
 * Get invitation by token query
 */
export const getInviteByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type GetInviteByTokenQuery = z.infer<typeof getInviteByTokenSchema>;
