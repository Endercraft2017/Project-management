/**
 * Daily Updates Routes
 * Defines API endpoints for daily updates
 */

import { Router } from 'express';
import { updatesController } from './controller';
import { isAuthenticated } from '@/auth/middleware';

const router = Router();

/**
 * GET /api/updates/days
 * List all days that have updates
 * Auth: All authenticated users
 */
router.get('/days', isAuthenticated, (req, res, next) => {
  updatesController.listDays(req, res, next);
});

/**
 * GET /api/updates/user/:date
 * Get current user's update for a specific date
 * Auth: All authenticated users
 */
router.get('/user/:date', isAuthenticated, (req, res, next) => {
  updatesController.getUserUpdateForDate(req, res, next);
});

/**
 * GET /api/updates/:date/missing-members
 * Get team members who haven't submitted updates for a specific date
 * Auth: All authenticated users
 * NOTE: Must come before /:date route to avoid route conflicts
 */
router.get('/:date/missing-members', isAuthenticated, (req, res, next) => {
  updatesController.getMissingMembers(req, res, next);
});

/**
 * GET /api/updates/:date/download
 * Download daily updates as Word document
 * Auth: All authenticated users
 * NOTE: Must come before /:date route to avoid route conflicts
 */
router.get('/:date/download', isAuthenticated, (req, res, next) => {
  updatesController.downloadDayUpdates(req, res, next);
});

/**
 * GET /api/updates/:date
 * Get all updates for a specific day
 * Auth: All authenticated users
 */
router.get('/:date', isAuthenticated, (req, res, next) => {
  updatesController.getDayUpdates(req, res, next);
});

/**
 * POST /api/updates
 * Create or update user's daily update
 * Auth: All authenticated users
 */
router.post('/', isAuthenticated, (req, res, next) => {
  updatesController.createOrUpdateUpdate(req, res, next);
});

/**
 * DELETE /api/updates/:id
 * Delete a daily update (only own updates)
 * Auth: All authenticated users (can only delete own)
 */
router.delete('/:id', isAuthenticated, (req, res, next) => {
  updatesController.deleteUpdate(req, res, next);
});

export default router;
