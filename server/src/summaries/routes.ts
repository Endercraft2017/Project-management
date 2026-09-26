/**
 * Weekly Summaries Routes
 * Defines API endpoints for AI-powered weekly summaries
 */

import { Router } from 'express';
import { weeklySummariesController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

/**
 * GET /api/summaries
 * List all weekly summaries
 * Auth: All authenticated users
 */
router.get('/', isAuthenticated, (req, res, next) => {
  weeklySummariesController.list(req, res, next);
});

/**
 * POST /api/summaries/generate
 * Generate a new weekly summary
 * Auth: Admin only
 */
router.post('/generate', isAdmin, (req, res, next) => {
  weeklySummariesController.generate(req, res, next);
});

/**
 * GET /api/summaries/:weekDate/grouped
 * Get weekly summary grouped by impact level
 * Auth: All authenticated users
 * NOTE: Must come before /:weekDate route to avoid conflicts
 */
router.get('/:weekDate/grouped', isAuthenticated, (req, res, next) => {
  weeklySummariesController.getGrouped(req, res, next);
});

/**
 * POST /api/summaries/:weekDate/send-email
 * Send weekly summary email manually
 * Auth: Admin only
 * NOTE: Must come before /:weekDate route to avoid conflicts
 */
router.post('/:weekDate/send-email', isAdmin, (req, res, next) => {
  weeklySummariesController.sendEmail(req, res, next);
});

/**
 * GET /api/summaries/:weekDate
 * Get weekly summary for a specific week
 * Auth: All authenticated users
 */
router.get('/:weekDate', isAuthenticated, (req, res, next) => {
  weeklySummariesController.getByWeek(req, res, next);
});

/**
 * DELETE /api/summaries/:id
 * Delete a weekly summary
 * Auth: Admin only
 */
router.delete('/:id', isAdmin, (req, res, next) => {
  weeklySummariesController.delete(req, res, next);
});

/**
 * GET /api/summaries/scheduler/status
 * Get scheduler status for debugging
 * Auth: Admin only
 */
router.get('/scheduler/status', isAdmin, (req, res, next) => {
  weeklySummariesController.getSchedulerStatus(req, res, next);
});

/**
 * POST /api/summaries/scheduler/trigger
 * Manually trigger the scheduler for testing
 * Auth: Admin only
 */
router.post('/scheduler/trigger', isAdmin, (req, res, next) => {
  weeklySummariesController.triggerScheduler(req, res, next);
});

export default router;
