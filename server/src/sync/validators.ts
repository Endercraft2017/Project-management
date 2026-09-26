/**
 * Google Sheets Sync Validators
 * Zod schemas for input validation
 */

import { z } from 'zod';

/**
 * Google Sheets ID validation (44 character alphanumeric + dashes/underscores)
 */
const spreadsheetIdRegex = /^[a-zA-Z0-9_-]{44}$/;

/**
 * Export to Google Sheets schema
 */
export const exportToSheetsSchema = z.object({
  spreadsheetId: z
    .string()
    .regex(spreadsheetIdRegex, 'Invalid Google Sheets spreadsheet ID format'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  overwrite: z.boolean().default(true),
});

export type ExportToSheets = z.infer<typeof exportToSheetsSchema>;

/**
 * Import from Google Sheets schema
 */
export const importFromSheetsSchema = z.object({
  spreadsheetId: z
    .string()
    .regex(spreadsheetIdRegex, 'Invalid Google Sheets spreadsheet ID format'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  conflictStrategy: z
    .enum(['lastWriterWins', 'skipConflicts', 'overwriteAll'])
    .default('lastWriterWins'),
});

export type ImportFromSheets = z.infer<typeof importFromSheetsSchema>;

/**
 * Bidirectional sync schema
 */
export const bidirectionalSyncSchema = z.object({
  spreadsheetId: z
    .string()
    .regex(spreadsheetIdRegex, 'Invalid Google Sheets spreadsheet ID format'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  conflictStrategy: z
    .enum(['lastWriterWins', 'skipConflicts', 'overwriteAll'])
    .default('lastWriterWins'),
});

export type BidirectionalSync = z.infer<typeof bidirectionalSyncSchema>;

/**
 * Get sync status query schema
 */
export const getSyncStatusQuerySchema = z.object({
  spreadsheetId: z
    .string()
    .regex(spreadsheetIdRegex, 'Invalid Google Sheets spreadsheet ID format')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type GetSyncStatusQuery = z.infer<typeof getSyncStatusQuerySchema>;
