/**
 * Daily Updates Request Validators
 * Zod schemas for validating daily update requests
 */

import { z } from 'zod';

/**
 * Schema for creating/updating a daily update
 * Validates date is within reasonable range (not more than 30 days in the past)
 */
export const createOrUpdateUpdateSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((dateStr) => {
      // Parse the date string as UTC midnight to avoid timezone issues
      const dateParts = dateStr.split('-');
      const date = new Date(Date.UTC(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      ));

      // Get today in UTC midnight
      const now = new Date();
      const today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      ));

      // Date must not be in the future
      if (date > today) {
        return false;
      }

      // Date must not be more than 30 days in the past
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

      return date >= thirtyDaysAgo;
    }, {
      message: 'Date must be within the last 30 days and not in the future',
    }),
  content: z.string().min(1, 'Content cannot be empty').max(5000, 'Content is too long'),
});

export type CreateOrUpdateUpdate = z.infer<typeof createOrUpdateUpdateSchema>;

/**
 * Schema for getting updates for a specific day
 */
export const getDayUpdatesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export type GetDayUpdates = z.infer<typeof getDayUpdatesSchema>;
