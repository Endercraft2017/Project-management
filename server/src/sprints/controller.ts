/**
 * Sprint Management Controller
 * Request handlers for sprint-related operations
 */

import { Request, Response, NextFunction } from 'express';
import { sprintService } from './service';
import {
  listSprintsQuerySchema,
  createSprintSchema,
  updateSprintSchema,
  uuidSchema,
  getSprintTasksQuerySchema,
  deleteSprintQuerySchema,
  getSprintQuerySchema,
} from './validators';
import { ZodError } from 'zod';

export class SprintController {
  /**
   * GET /api/sprints
   * List all sprints with filtering and pagination
   */
  async listSprints(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listSprintsQuerySchema.parse(req.query);
      const result = await sprintService.listSprints(query);

      res.json({
        success: true,
        data: result.sprints,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/sprints/:id
   * Get sprint by ID
   */
  async getSprintById(req: Request, res: Response, next: NextFunction) {
    try {
      const sprintId = uuidSchema.parse(req.params.id);
      const { includeTasks } = getSprintQuerySchema.parse(req.query);

      const sprint = await sprintService.getSprintById(sprintId, includeTasks);

      if (!sprint) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Sprint not found',
        });
      }

      res.json({
        success: true,
        data: sprint,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid sprint ID',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/sprints
   * Create a new sprint
   */
  async createSprint(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSprintSchema.parse(req.body);

      // Check for overlapping sprints
      const hasOverlap = await sprintService.checkSprintOverlap(
        data.startDate,
        data.endDate
      );

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Sprint dates overlap with an existing sprint',
        });
      }

      const sprint = await sprintService.createSprint(data, req.user!.id);

      // Log sprint creation for audit
      console.log(
        `Sprint created: "${sprint.name}" (${sprint.id}) by ${req.user?.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Sprint created successfully',
        data: sprint,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid input',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/sprints/:id
   * Update an existing sprint
   */
  async updateSprint(req: Request, res: Response, next: NextFunction) {
    try {
      const sprintId = uuidSchema.parse(req.params.id);
      const data = updateSprintSchema.parse(req.body);

      // If dates are being updated, check for overlaps
      if (data.startDate || data.endDate) {
        // Get existing sprint to use current dates if not provided
        const existingSprint = await sprintService.getSprintById(sprintId);

        if (!existingSprint) {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'Sprint not found',
          });
        }

        const startDate = data.startDate || existingSprint.startDate;
        const endDate = data.endDate || existingSprint.endDate;

        const hasOverlap = await sprintService.checkSprintOverlap(
          startDate,
          endDate,
          sprintId // Exclude current sprint from overlap check
        );

        if (hasOverlap) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: 'Sprint dates overlap with another sprint',
          });
        }
      }

      const sprint = await sprintService.updateSprint(sprintId, data);

      // Log sprint update for audit
      console.log(
        `Sprint updated: "${sprint.name}" (${sprint.id}) by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Sprint updated successfully',
        data: sprint,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid input',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Sprint not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Sprint not found',
        });
      }

      if (
        error instanceof Error &&
        error.message === 'End date must be after start date'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * DELETE /api/sprints/:id
   * Delete a sprint
   */
  async deleteSprint(req: Request, res: Response, next: NextFunction) {
    try {
      const sprintId = uuidSchema.parse(req.params.id);
      const { moveTasksToBacklog, deleteTasks } = deleteSprintQuerySchema.parse(req.query);

      await sprintService.deleteSprint(sprintId, moveTasksToBacklog, deleteTasks);

      // Log sprint deletion for audit
      console.log(`Sprint deleted: ${sprintId} by ${req.user?.email}`);

      res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid sprint ID',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Sprint not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Sprint not found',
        });
      }

      if (error instanceof Error && error.message.includes('Sprint has')) {
        return res.status(400).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Cannot use both deleteTasks and moveTasksToBacklog')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/sprints/:id/tasks
   * Get tasks in a sprint
   */
  async getSprintTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const sprintId = uuidSchema.parse(req.params.id);
      const query = getSprintTasksQuerySchema.parse(req.query);

      const result = await sprintService.getSprintTasks(sprintId, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid parameters',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Sprint not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Sprint not found',
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/sprints/active
   * Get currently active sprint
   */
  async getActiveSprint(req: Request, res: Response, next: NextFunction) {
    try {
      const sprint = await sprintService.getActiveSprint();

      if (!sprint) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'No active sprint found',
        });
      }

      res.json({
        success: true,
        data: sprint,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sprintController = new SprintController();
