/**
 * User Management Routes
 * Defines API endpoints for user operations
 */

import { Router } from 'express';
import { userController } from './controller';
import { isAuthenticated, isAdmin, isAdminOrOwner } from '@/auth/middleware';

const router = Router();

/**
 * GET /api/users
 * List all users with filtering and pagination
 * Auth: Authenticated users (all members can view user list for chat/mentions)
 */
router.get('/', isAuthenticated, (req, res, next) => {
  userController.listUsers(req, res, next);
});

/**
 * GET /api/users/:id
 * Get user by ID
 * Auth: Admin or self
 */
router.get('/:id', isAuthenticated, isAdminOrOwner, (req, res, next) => {
  userController.getUserById(req, res, next);
});

/**
 * PATCH /api/users/:id
 * Update user profile
 * Auth: Admin or self (self can only update name)
 */
router.patch('/:id', isAuthenticated, isAdminOrOwner, (req, res, next) => {
  userController.updateUser(req, res, next);
});

/**
 * PUT /api/users/:id/role
 * Update user role
 * Auth: Admin only
 */
router.put('/:id/role', isAuthenticated, isAdmin, (req, res, next) => {
  userController.updateUserRole(req, res, next);
});

/**
 * DELETE /api/users/:id
 * Deactivate user (soft delete)
 * Auth: Admin only
 */
router.delete('/:id', isAuthenticated, isAdmin, (req, res, next) => {
  userController.deactivateUser(req, res, next);
});

/**
 * POST /api/users/:id/activate
 * Activate deactivated user
 * Auth: Admin only
 */
router.post('/:id/activate', isAuthenticated, isAdmin, (req, res, next) => {
  userController.activateUser(req, res, next);
});

/**
 * GET /api/users/:id/stats
 * Get user statistics
 * Auth: Admin or self
 */
router.get('/:id/stats', isAuthenticated, isAdminOrOwner, (req, res, next) => {
  userController.getUserStats(req, res, next);
});

export default router;
