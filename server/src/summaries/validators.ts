/**
 * Validators for Weekly Summaries API
 */

import { z } from 'zod';

/**
 * Generate weekly summary request
 */
export const generateWeeklySummarySchema = z.object({
  weekDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * Get weekly summary request
 */
export const getWeeklySummarySchema = z.object({
  weekDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * List weekly summaries request
 */
export const listWeeklySummariesSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Send summary email request
 */
export const sendSummaryEmailSchema = z.object({
  summaryId: z.string().uuid(),
  recipientEmail: z.string().email(),
});
