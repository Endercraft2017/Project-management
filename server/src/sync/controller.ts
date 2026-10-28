/**
 * Google Sheets Sync Controller
 * Request handlers for sync operations
 */

import { Request, Response, NextFunction } from 'express';
import { getSyncService } from './service';
import {
  exportToSheetsSchema,
  importFromSheetsSchema,
  bidirectionalSyncSchema,
  getSyncStatusQuerySchema,
} from './validators';
import { ZodError } from 'zod';

const syncService = getSyncService();

export class SyncController {
  /**
   * POST /api/sync/export-to-sheets
   * Export tasks to Google Sheets
   */
  async exportToSheets(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportToSheetsSchema.parse(req.body);
      const userId = req.user!.id;

      console.log(
        `[Sync] Export to sheets started by ${req.user?.email}: ${data.spreadsheetId}`
      );

      const startTime = Date.now();
      const result = await syncService.exportToSheets(
        data.spreadsheetId,
        data.sheetName,
        data.overwrite,
        userId
      );
      const duration = Date.now() - startTime;

      console.log(
        `[Sync] Export completed: ${result.recordsExported} tasks exported in ${duration}ms by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Tasks exported to Google Sheets successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid input',
          details: error.issues,
        });
      }

      if (error instanceof Error) {
        if (error.message === 'Spreadsheet not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }

        if (error.message.includes('Access denied')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: error.message,
          });
        }

        if (error.message.includes('service account')) {
          return res.status(500).json({
            success: false,
            error: 'Configuration Error',
            message:
              'Google Sheets API is not properly configured. Please check service account credentials.',
          });
        }
      }

      next(error);
    }
  }

  /**
   * POST /api/sync/import-from-sheets
   * Import tasks from Google Sheets
   */
  async importFromSheets(req: Request, res: Response, next: NextFunction) {
    try {
      const data = importFromSheetsSchema.parse(req.body);
      const userId = req.user!.id;

      console.log(
        `[Sync] Import from sheets started by ${req.user?.email}: ${data.spreadsheetId}`
      );

      const startTime = Date.now();
      const result = await syncService.importFromSheets(
        data.spreadsheetId,
        data.sheetName,
        data.conflictStrategy,
        userId
      );
      const duration = Date.now() - startTime;

      console.log(
        `[Sync] Import completed: ${result.recordsImported} imported, ${result.recordsUpdated} updated, ${result.conflicts.length} conflicts in ${duration}ms by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Tasks imported from Google Sheets successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid input',
          details: error.issues,
        });
      }

      if (error instanceof Error) {
        if (error.message === 'Spreadsheet not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }

        if (error.message === 'Sheet not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `Sheet "${req.body.sheetName || 'Tasks'}" not found in spreadsheet`,
          });
        }

        if (error.message.includes('Access denied')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: error.message,
          });
        }

        if (error.message.includes('Invalid sheet format')) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message,
          });
        }
      }

      next(error);
    }
  }

  /**
   * POST /api/sync/bidirectional
   * Perform bidirectional sync between database and Google Sheets
   */
  async bidirectionalSync(req: Request, res: Response, next: NextFunction) {
    try {
      const data = bidirectionalSyncSchema.parse(req.body);
      const userId = req.user!.id;

      console.log(
        `[Sync] Bidirectional sync started by ${req.user?.email}: ${data.spreadsheetId}`
      );

      const startTime = Date.now();
      const result = await syncService.bidirectionalSync(
        data.spreadsheetId,
        data.sheetName,
        data.conflictStrategy,
        userId
      );
      const duration = Date.now() - startTime;

      console.log(
        `[Sync] Bidirectional sync completed: exported ${result.recordsExported}, imported ${result.recordsImported}, updated ${result.recordsUpdated}, conflicts: ${result.conflicts.length} in ${duration}ms by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Bidirectional sync completed successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid input',
          details: error.issues,
        });
      }

      if (error instanceof Error) {
        if (
          error.message === 'Spreadsheet not found' ||
          error.message === 'Sheet not found'
        ) {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }

        if (error.message.includes('Access denied')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: error.message,
          });
        }
      }

      next(error);
    }
  }

  /**
   * GET /api/sync/status
   * Get sync status and history
   */
  async getSyncStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getSyncStatusQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const status = await syncService.getSyncStatus(userId, query.spreadsheetId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * POST /api/sync/resolve-conflicts
   * Resolve note conflicts from import
   */
  async resolveConflicts(req: Request, res: Response, next: NextFunction) {
    try {
      const { spreadsheetId, sheetName, resolutions } = req.body;
      const userId = req.user!.id;

      if (!spreadsheetId || !sheetName || !resolutions || !Array.isArray(resolutions)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Missing required fields: spreadsheetId, sheetName, resolutions',
        });
      }

      console.log(
        `[Sync] Resolving ${resolutions.length} conflicts by ${req.user?.email}`
      );

      const startTime = Date.now();
      const result = await syncService.resolveConflicts(
        spreadsheetId,
        sheetName,
        resolutions,
        userId
      );
      const duration = Date.now() - startTime;

      console.log(
        `[Sync] Conflicts resolved: ${result.recordsUpdated} tasks updated in ${duration}ms by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Conflicts resolved successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Spreadsheet not found') {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }

        if (error.message.includes('Access denied')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: error.message,
          });
        }
      }

      next(error);
    }
  }
}

export const syncController = new SyncController();
