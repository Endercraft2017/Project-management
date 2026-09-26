/**
 * Google Sheets Sync Routes
 * Defines API endpoints for sync operations
 */

import { Router } from 'express';
import { syncController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

/**
 * POST /api/sync/export-to-sheets
 * Export tasks to Google Sheets
 * Auth: Admin only
 */
router.post('/export-to-sheets', isAuthenticated, isAdmin, (req, res, next) => {
  syncController.exportToSheets(req, res, next);
});

/**
 * POST /api/sync/import-from-sheets
 * Import tasks from Google Sheets
 * Auth: Admin only
 */
router.post('/import-from-sheets', isAuthenticated, isAdmin, (req, res, next) => {
  syncController.importFromSheets(req, res, next);
});

/**
 * POST /api/sync/bidirectional
 * Perform bidirectional sync
 * Auth: Admin only
 */
router.post('/bidirectional', isAuthenticated, isAdmin, (req, res, next) => {
  syncController.bidirectionalSync(req, res, next);
});

/**
 * GET /api/sync/status
 * Get sync status and history
 * Auth: Admin only
 */
router.get('/status', isAuthenticated, isAdmin, (req, res, next) => {
  syncController.getSyncStatus(req, res, next);
});

/**
 * POST /api/sync/resolve-conflicts
 * Resolve note conflicts from import
 * Auth: Admin only
 */
router.post('/resolve-conflicts', isAuthenticated, isAdmin, (req, res, next) => {
  syncController.resolveConflicts(req, res, next);
});

export default router;
