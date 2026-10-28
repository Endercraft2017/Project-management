/**
 * User Management Controller
 * Request handlers for user-related operations
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from './service';
import {
  listUsersQuerySchema,
  updateUserSchema,
  updateRoleSchema,
  uuidSchema,
} from './validators';
import { ZodError } from 'zod';

export class UserController {
  /**
   * GET /api/users
   * List all users with filtering and pagination
   */
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listUsersQuerySchema.parse(req.query);
      const result = await userService.listUsers(query);

      res.json({
        success: true,
        data: result,
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
   * GET /api/users/:id
   * Get user by ID
   */
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);
      const includeStats = req.query.includeStats === 'true';

      const user = await userService.getUserById(userId, includeStats);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid user ID',
          details: error.issues,
        });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/users/:id
   * Update user profile
   */
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);
      const data = updateUserSchema.parse(req.body);

      const user = await userService.updateUser(userId, data);

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user,
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
      next(error);
    }
  }

  /**
   * PUT /api/users/:id/role
   * Update user role (admin only)
   */
  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);
      const data = updateRoleSchema.parse(req.body);

      const user = await userService.updateUserRole(userId, data, req.user!.id);

      // Log role change for audit
      console.log(`Role changed: User ${userId} changed to ${data.role} by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: user,
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
      next(error);
    }
  }

  /**
   * DELETE /api/users/:id
   * Deactivate user (soft delete)
   */
  async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);

      const user = await userService.deactivateUser(userId, req.user!.id);

      // Log deactivation for audit
      console.log(`User deactivated: ${userId} by ${req.user?.email}`);

      res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid user ID',
          details: error.issues,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/users/:id/activate
   * Activate user
   */
  async activateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);

      const user = await userService.activateUser(userId, req.user!.id);

      // Log activation for audit
      console.log(`User activated: ${userId} by ${req.user?.email}`);

      res.json({
        success: true,
        message: 'User activated successfully',
        data: user,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid user ID',
          details: error.issues,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/users/:id/stats
   * Get user statistics
   */
  async getUserStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = uuidSchema.parse(req.params.id);

      const stats = await userService.getUserStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid user ID',
          details: error.issues,
        });
      }
      next(error);
    }
  }
}

export const userController = new UserController();
