/**
 * Notes Validators
 * Zod schemas for request validation
 */

import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().max(50000, 'Content too long'),
  tags: z.array(z.string()).optional().default([]),
  isPinned: z.boolean().optional().default(false),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  content: z.string().max(50000, 'Content too long').optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
});

export const getNoteSchema = z.object({
  id: z.string().uuid('Invalid note ID'),
});

export const listNotesQuerySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  pinned: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).optional().default('50'),
  offset: z.string().regex(/^\d+$/).optional().default('0'),
});

export const addReminderSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  remindAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
});

export const updateReminderSchema = z.object({
  remindAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  isCompleted: z.boolean().optional(),
});

export const deleteReminderSchema = z.object({
  id: z.string().uuid('Invalid reminder ID'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type AddReminderInput = z.infer<typeof addReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
