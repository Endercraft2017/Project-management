/**
 * Admin Settings Routes
 * Defines API endpoints for system configuration
 */

import { Router } from 'express';
import { adminController } from './controller';
import { isAdmin } from '@/auth/middleware';

const router = Router();

/**
 * GET /api/admin/settings/weekly-summary-email/config
 * Get weekly summary email configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.get('/settings/weekly-summary-email/config', isAdmin, (req, res, next) => {
  adminController.getWeeklySummaryEmailConfig(req, res, next);
});

/**
 * PUT /api/admin/settings/weekly-summary-email/config
 * Update weekly summary email configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.put('/settings/weekly-summary-email/config', isAdmin, (req, res, next) => {
  adminController.updateWeeklySummaryEmailConfig(req, res, next);
});

/**
 * GET /api/admin/settings/weekly-summary-members/config
 * Get weekly summary member selection configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.get('/settings/weekly-summary-members/config', isAdmin, (req, res, next) => {
  adminController.getWeeklySummaryMembersConfig(req, res, next);
});

/**
 * PUT /api/admin/settings/weekly-summary-members/config
 * Update weekly summary member selection configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.put('/settings/weekly-summary-members/config', isAdmin, (req, res, next) => {
  adminController.updateWeeklySummaryMembersConfig(req, res, next);
});

/**
 * GET /api/admin/settings/missing-updates/config
 * Get missing updates tracking configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.get('/settings/missing-updates/config', isAdmin, (req, res, next) => {
  adminController.getMissingUpdatesConfig(req, res, next);
});

/**
 * PUT /api/admin/settings/missing-updates/config
 * Update missing updates tracking configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.put('/settings/missing-updates/config', isAdmin, (req, res, next) => {
  adminController.updateMissingUpdatesConfig(req, res, next);
});

/**
 * GET /api/admin/settings/automated-reminder/config
 * Get automated daily reminder configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.get('/settings/automated-reminder/config', isAdmin, (req, res, next) => {
  adminController.getAutomatedReminderConfig(req, res, next);
});

/**
 * PUT /api/admin/settings/automated-reminder/config
 * Update automated daily reminder configuration
 * Auth: Admin only
 * NOTE: Must come before /:key route to avoid conflicts
 */
router.put('/settings/automated-reminder/config', isAdmin, (req, res, next) => {
  adminController.updateAutomatedReminderConfig(req, res, next);
});

/**
 * GET /api/admin/updates/missing
 * Get users with missing daily updates
 * Auth: Admin only
 * Query params: startDate (optional), endDate (optional)
 */
router.get('/updates/missing', isAdmin, (req, res, next) => {
  adminController.getMissingUpdates(req, res, next);
});

/**
 * POST /api/admin/updates/send-reminder
 * Send update reminder notification to a user
 * Auth: Admin only
 * Body: { userId: string, missingDates: string[] }
 */
router.post('/updates/send-reminder', isAdmin, (req, res, next) => {
  adminController.sendUpdateReminder(req, res, next);
});

/**
 * GET /api/admin/settings
 * List all settings
 * Auth: Admin only
 */
router.get('/settings', isAdmin, (req, res, next) => {
  adminController.listSettings(req, res, next);
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 * Auth: Admin only
 */
router.get('/settings/:key', isAdmin, (req, res, next) => {
  adminController.getSetting(req, res, next);
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting
 * Auth: Admin only
 */
router.put('/settings/:key', isAdmin, (req, res, next) => {
  adminController.updateSetting(req, res, next);
});

/**
 * DELETE /api/admin/settings/:key
 * Delete a setting
 * Auth: Admin only
 */
router.delete('/settings/:key', isAdmin, (req, res, next) => {
  adminController.deleteSetting(req, res, next);
});

export default router;
