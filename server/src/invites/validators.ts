import { z } from 'zod';
import { Role, InviteStatus } from '@prisma/client';

export const sendInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format').max(254),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(Role).default(Role.MEMBER),
}).strict();
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export const listInvitesQuerySchema = z.object({
  status: z.nativeEnum(InviteStatus).optional(),
  email: z.string().trim().max(254).optional(),
}).strict();
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;
export const revokeInviteParamsSchema = z.object({ id: z.string().uuid('Invalid invitation ID') });
export type RevokeInviteParams = z.infer<typeof revokeInviteParamsSchema>;
