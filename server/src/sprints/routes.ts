/**
 * Sprint Management Routes
 * Defines API endpoints for sprint operations
 */

import { Router } from 'express';
import { sprintController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

/**
 * GET /api/sprints
 * List all sprints with filtering and pagination
 * Auth: All authenticated users
 */
router.get('/', isAuthenticated, (req, res, next) => {
  sprintController.listSprints(req, res, next);
});

/**
 * GET /api/sprints/active
 * Get currently active sprint
 * Auth: All authenticated users
 * Note: Must be before /:id route to avoid treating "active" as an ID
 */
router.get('/active', isAuthenticated, (req, res, next) => {
  sprintController.getActiveSprint(req, res, next);
});

/**
 * GET /api/sprints/:id
 * Get sprint by ID
 * Auth: All authenticated users
 */
router.get('/:id', isAuthenticated, (req, res, next) => {
  sprintController.getSprintById(req, res, next);
});

/**
 * GET /api/sprints/:id/tasks
 * Get tasks in a sprint
 * Auth: All authenticated users
 */
router.get('/:id/tasks', isAuthenticated, (req, res, next) => {
  sprintController.getSprintTasks(req, res, next);
});

/**
 * POST /api/sprints
 * Create a new sprint
 * Auth: Admin only
 */
router.post('/', isAuthenticated, isAdmin, (req, res, next) => {
  sprintController.createSprint(req, res, next);
});

/**
 * PUT /api/sprints/:id
 * Update an existing sprint
 * Auth: Admin only
 */
router.put('/:id', isAuthenticated, isAdmin, (req, res, next) => {
  sprintController.updateSprint(req, res, next);
});

/**
 * DELETE /api/sprints/:id
 * Delete a sprint
 * Auth: Admin only
 */
router.delete('/:id', isAuthenticated, isAdmin, (req, res, next) => {
  sprintController.deleteSprint(req, res, next);
});

export default router;
