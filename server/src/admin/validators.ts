/**
 * Validators for Admin Settings API
 */

import { z } from 'zod';

/**
 * Weekly summary email configuration schema
 */
export const weeklySummaryEmailConfigSchema = z.object({
  enabled: z.boolean(),
  recipientEmail: z.string().email(),
  sendDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)'),
});

/**
 * Weekly summary member selection configuration schema
 */
export const weeklySummaryMembersConfigSchema = z.object({
  includedUserIds: z.array(z.string().uuid()).min(0),
});

/**
 * Update setting request
 */
export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(), // Will be validated based on the key
});

/**
 * Get setting request
 */
export const getSettingSchema = z.object({
  key: z.string().min(1),
});

/**
 * Missing updates tracking configuration schema
 */
export const missingUpdatesConfigSchema = z.object({
  enabled: z.boolean(),
  includedUserIds: z.array(z.string().uuid()).min(0),
  checkBusinessDaysOnly: z.boolean(), // Monday-Friday only
  defaultDateRange: z.enum(['current_week', 'last_7_days', 'last_14_days', 'last_30_days']),
});

/**
 * Get missing updates request schema
 */
export const getMissingUpdatesSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: 'Start date must be before or equal to end date',
  }
).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 90; // Max 90 days range
  },
  {
    message: 'Date range cannot exceed 90 days',
  }
);

/**
 * Send update reminder request schema
 */
export const sendUpdateReminderSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  missingDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')).min(1, 'At least one missing date is required'),
});

/**
 * Automated daily reminder configuration schema
 */
export const automatedReminderConfigSchema = z.object({
  enabled: z.boolean(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)'),
});
