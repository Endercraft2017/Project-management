/**
 * File Parser
 * CSV and Excel parsing utilities
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { taskImportRowSchema, TaskImportRow } from './validators';
import { ZodError } from 'zod';

/**
 * Parse CSV file
 */
export async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: 'greedy', // Skip lines that are completely empty or only whitespace
      dynamicTyping: false, // Keep everything as strings for validation
      complete: (results) => {
        // Additional filtering: remove rows where all values are empty/whitespace
        const filteredData = (results.data as any[]).filter((row: any) => {
          // Check if row has at least one non-empty value
          return Object.values(row).some(val =>
            val !== null &&
            val !== undefined &&
            typeof val === 'string' &&
            val.trim() !== ''
          );
        });
        resolve(filteredData);
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export function parseExcel(filePath: string): any[] {
  try {
    const workbook = XLSX.readFile(filePath);

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel file has no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, {
      raw: false, // Format values as strings
      defval: '', // Default value for empty cells
    });

    // Filter out blank rows (rows where all values are empty/whitespace)
    const filteredData = (data as any[]).filter((row: any) => {
      return Object.values(row).some(val =>
        val !== null &&
        val !== undefined &&
        typeof val === 'string' &&
        val.trim() !== ''
      );
    });

    return filteredData;
  } catch (error: any) {
    throw new Error(`Excel parsing failed: ${error.message}`);
  }
}

/**
 * Parse file based on extension
 */
export async function parseFile(filePath: string): Promise<any[]> {
  const ext = filePath.toLowerCase();

  if (ext.endsWith('.csv')) {
    return await parseCSV(filePath);
  } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    return parseExcel(filePath);
  } else {
    throw new Error('Unsupported file format. Use .csv, .xls, or .xlsx');
  }
}

/**
 * Validate task import rows
 */
export function validateTaskRows(rows: any[]): {
  valid: TaskImportRow[];
  errors: Array<{ row: number; error: string; data?: any }>;
} {
  const valid: TaskImportRow[] = [];
  const errors: Array<{ row: number; error: string; data?: any }> = [];

  // Check row count limit
  if (rows.length > 10000) {
    throw new Error('File has too many rows. Maximum 10,000 rows allowed.');
  }

  if (rows.length === 0) {
    throw new Error('File is empty. No rows to import.');
  }

  rows.forEach((row, index) => {
    try {
      // Validate with Zod schema
      const validated = taskImportRowSchema.parse(row);
      valid.push(validated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const firstError = error.issues[0];
        errors.push({
          row: index + 2, // +2 for header row and 1-indexed
          error: `${String(firstError.path[0] ?? 'row')}: ${firstError.message}`,
          data: row,
        });
      } else {
        errors.push({
          row: index + 2,
          error: error.message,
          data: row,
        });
      }
    }
  });

  return { valid, errors };
}

/**
 * Parse date string to Date object
 * Supports ISO 8601 and MM/DD/YYYY formats
 */
export function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  // Try ISO 8601 format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Invalid date
  return null;
}

/**
 * Validate expected CSV headers
 * Format: Tasks | Subtasks | Sprint | Details | Progress % | Assigned to | Deadline
 */
export function validateHeaders(rows: any[]): {
  valid: boolean;
  missingHeaders: string[];
} {
  if (rows.length === 0) {
    return { valid: false, missingHeaders: ['No data'] };
  }

  const firstRow = rows[0];
  const requiredHeaders = ['Tasks', 'Progress %'];
  const missingHeaders: string[] = [];

  requiredHeaders.forEach((header) => {
    if (!(header in firstRow)) {
      missingHeaders.push(header);
    }
  });

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
  };
}
