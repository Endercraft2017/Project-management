/**
 * Upload Validators
 * Zod schemas for file upload validation
 */

import { z } from 'zod';

/**
 * Upload chat attachment schema
 */
export const uploadChatAttachmentSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
});

export type UploadChatAttachment = z.infer<typeof uploadChatAttachmentSchema>;

/**
 * Task import row schema (CSV/Excel)
 * Format: Tasks | Subtasks | Sprint | Details | Progress % | Assigned to | Deadline
 */
export const taskImportRowSchema = z.object({
  'Tasks': z.string().min(1, 'Task name required').max(200, 'Task name too long'),
  'Subtasks': z.string().max(200, 'Subtask name too long').optional().default(''),
  'Sprint': z.string().max(100, 'Sprint name too long').optional().default(''),
  'Details': z.string().max(1000, 'Details too long').optional().default(''),
  'Progress %': z.coerce.number().min(0, 'Progress must be 0-100').max(100, 'Progress must be 0-100'),
  'Assigned to': z.string().optional().default(''),
  'Deadline': z.string().optional().default(''),
});

export type TaskImportRow = z.infer<typeof taskImportRowSchema>;

/**
 * List files query schema
 */
export const listFilesQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
