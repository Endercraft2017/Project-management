/**
 * Task Management Routes
 * Defines API endpoints for task operations
 */

import { Router } from 'express';
import { taskController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import { getSummaryStatistics } from './statistics';

const router = Router();

/**
 * GET /api/tasks/statistics/summary
 * Get summary statistics for dashboard
 * Auth: All authenticated users
 */
router.get('/statistics/summary', isAuthenticated, async (req, res, next) => {
  try {
    const statistics = await getSummaryStatistics();
    res.json({ success: true, data: statistics });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks
 * List all tasks with filtering and pagination
 * Auth: All authenticated users (see assigned/created tasks, admins see all)
 */
router.get('/', isAuthenticated, (req, res, next) => {
  taskController.listTasks(req, res, next);
});

/**
 * POST /api/tasks
 * Create a new top-level task
 * Auth: All authenticated users (can create for self, admins can assign to anyone)
 */
router.post('/', isAuthenticated, (req, res, next) => {
  taskController.createTask(req, res, next);
});

/**
 * GET /api/tasks/:id
 * Get task by ID
 * Auth: Task assignee, creator, or admin
 */
router.get('/:id', isAuthenticated, (req, res, next) => {
  taskController.getTaskById(req, res, next);
});

/**
 * PUT /api/tasks/:id
 * PATCH /api/tasks/:id
 * Update an existing task
 * Auth: Task assignee, creator, or admin
 */
router.put('/:id', isAuthenticated, (req, res, next) => {
  taskController.updateTask(req, res, next);
});
router.patch('/:id', isAuthenticated, (req, res, next) => {
  taskController.updateTask(req, res, next);
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 * Auth: Task creator, assignee, or admin
 * Note: Members can delete their own created tasks/subtasks
 */
router.delete('/:id', isAuthenticated, (req, res, next) => {
  taskController.deleteTask(req, res, next);
});

/**
 * GET /api/tasks/:id/hierarchy
 * Get task hierarchy (ancestors and descendants)
 * Auth: Task assignee, creator, or admin
 */
router.get('/:id/hierarchy', isAuthenticated, (req, res, next) => {
  taskController.getTaskHierarchy(req, res, next);
});

/**
 * GET /api/tasks/:id/stats
 * Get task statistics
 * Auth: Task assignee, creator, or admin
 */
router.get('/:id/stats', isAuthenticated, (req, res, next) => {
  taskController.getTaskStats(req, res, next);
});

/**
 * POST /api/tasks/:id/subtasks
 * Create a subtask under a parent task
 * Auth: Parent task assignee, creator, or admin
 */
router.post('/:id/subtasks', isAuthenticated, (req, res, next) => {
  taskController.createSubtask(req, res, next);
});

/**
 * PATCH /api/tasks/:id/sprint
 * Move task and all subtasks to different sprint
 * Auth: Admin only
 */
router.patch('/:id/sprint', isAuthenticated, isAdmin, (req, res, next) => {
  taskController.moveToSprint(req, res, next);
});

/**
 * DELETE /api/tasks/bulk/all
 * Delete all tasks in the system
 * Auth: Admin only
 */
router.delete('/bulk/all', isAuthenticated, isAdmin, (req, res, next) => {
  taskController.deleteAllTasks(req, res, next);
});

/**
 * DELETE /api/tasks/bulk/sprint/:sprintId
 * Delete all tasks in a specific sprint
 * Auth: Admin only
 */
router.delete('/bulk/sprint/:sprintId', isAuthenticated, isAdmin, (req, res, next) => {
  taskController.deleteSprintTasks(req, res, next);
});

/**
 * DELETE /api/tasks/:id/subtasks
 * Delete all subtasks under a specific task
 * Auth: Admin only
 */
router.delete('/:id/subtasks', isAuthenticated, isAdmin, (req, res, next) => {
  taskController.deleteTaskSubtasks(req, res, next);
});

export default router;
