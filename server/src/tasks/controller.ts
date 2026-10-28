/**
 * Task Management Controller
 * Request handlers for task-related operations
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { taskService } from './service';
import {
  listTasksQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  moveToSprintSchema,
  uuidSchema,
  deleteTaskQuerySchema,
  getTaskQuerySchema,
} from './validators';
import { ZodError } from 'zod';

export class TaskController {
  /**
   * GET /api/tasks
   * List all tasks with filtering and pagination
   */
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listTasksQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const result = await taskService.listTasks(query, userId, isAdmin);

      res.json({
        success: true,
        data: result.tasks,
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
   * GET /api/tasks/:id
   * Get task by ID
   */
  async getTaskById(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const { includeSubtasks, includeParent } = getTaskQuerySchema.parse(
        req.query
      );
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const task = await taskService.getTaskById(
        taskId,
        includeSubtasks,
        includeParent
      );

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Task not found',
        });
      }

      // Presentation hints, including chat mentions, never grant resource access.
      const hasPermission =
        isAdmin ||
        task.assignedToId === userId ||
        task.createdById === userId;

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'No permission to access this task',
        });
      }

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid task ID',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/tasks
   * Create a new top-level task
   */
  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createTaskSchema.parse(req.body);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const task = await taskService.createTask(data, userId, isAdmin);

      // Log task creation for audit
      console.log(
        `Task created: "${task.taskName}" (${task.id}) by ${req.user?.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: task,
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

      if (
        error instanceof Error &&
        (error.message === 'Sprint not found' ||
          error.message === 'Assigned user not found')
      ) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message === 'Only admins can assign tasks to other users'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /api/tasks/:id/subtasks
   * Create a subtask under a parent task
   */
  async createSubtask(req: Request, res: Response, next: NextFunction) {
    try {
      const parentId = uuidSchema.parse(req.params.id);
      const data = createTaskSchema.parse(req.body);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const task = await taskService.createSubtask(
        parentId,
        data,
        userId,
        isAdmin
      );

      // Log subtask creation for audit
      console.log(
        `Subtask created: "${task.taskName}" (${task.id}) under parent ${parentId} by ${req.user?.email}`
      );

      res.status(201).json({
        success: true,
        message: 'Subtask created successfully',
        data: task,
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

      if (
        error instanceof Error &&
        (error.message === 'Parent task not found' ||
          error.message === 'Assigned user not found')
      ) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        (error.message ===
          'No permission to create subtask under this task' ||
          error.message === 'Only admins can assign tasks to other users')
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message.includes('Maximum nesting depth')
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
   * PUT /api/tasks/:id
   * Update an existing task
   */
  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const data = updateTaskSchema.parse(req.body);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const task = await taskService.updateTask(taskId, data, userId, isAdmin);

      // Log task update for audit
      console.log(
        `Task updated: "${task.taskName}" (${task.id}) by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: task,
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

      if (
        error instanceof Error &&
        (error.message === 'Task not found' ||
          error.message === 'Sprint not found' ||
          error.message === 'Assigned user not found')
      ) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        (error.message === 'No permission to update this task' ||
          error.message === 'Only admins can reassign tasks to other users')
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message.includes('Cannot change sprint')
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
   * DELETE /api/tasks/bulk/all
   * Delete all tasks in the system
   */
  async deleteAllTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const deletedCount = await taskService.deleteAllTasks();

      console.log(`All tasks deleted: ${deletedCount} tasks by ${req.user?.email}`);

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} tasks`,
        data: { deletedCount },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/tasks/bulk/sprint/:sprintId
   * Delete all tasks in a specific sprint
   */
  async deleteSprintTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const sprintId = uuidSchema.parse(req.params.sprintId);
      const deletedCount = await taskService.deleteSprintTasks(sprintId);

      console.log(`Sprint tasks deleted: ${deletedCount} tasks from sprint ${sprintId} by ${req.user?.email}`);

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} tasks from sprint`,
        data: { deletedCount },
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
   * DELETE /api/tasks/:id/subtasks
   * Delete all subtasks under a specific task
   */
  async deleteTaskSubtasks(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const deletedCount = await taskService.deleteTaskSubtasks(taskId);

      console.log(`Task subtasks deleted: ${deletedCount} subtasks from task ${taskId} by ${req.user?.email}`);

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} subtasks`,
        data: { deletedCount },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid task ID',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Task not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * PATCH /api/tasks/:id/sprint
   * Move task to different sprint
   */
  async moveToSprint(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const { sprintId } = moveToSprintSchema.parse(req.body);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const result = await taskService.moveToSprint(
        taskId,
        sprintId,
        userId,
        isAdmin
      );

      // Log sprint move for audit
      console.log(
        `Task moved to sprint: ${taskId} to ${sprintId || 'backlog'} (${result.subtasksUpdated} subtasks) by ${req.user?.email}`
      );

      res.json({
        success: true,
        message: 'Task moved to sprint successfully',
        data: result,
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

      if (
        error instanceof Error &&
        (error.message === 'Task not found' ||
          error.message === 'Sprint not found')
      ) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message === 'Only admins can move tasks to different sprints'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * DELETE /api/tasks/:id
   * Delete a task
   */
  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const { cascade } = deleteTaskQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      await taskService.deleteTask(taskId, cascade, userId, isAdmin);

      // Log task deletion for audit
      console.log(
        `Task deleted: ${taskId} (cascade=${cascade}) by ${req.user?.email}`
      );

      res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid task ID',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Task not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message === 'No permission to delete this task') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('Task has')) {
        return res.status(400).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/tasks/:id/hierarchy
   * Get task hierarchy
   */
  async getTaskHierarchy(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const hierarchy = await taskService.getTaskHierarchy(
        taskId,
        userId,
        isAdmin
      );

      res.json({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid task ID',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Task not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message === 'No permission to view this task'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/tasks/:id/stats
   * Get task statistics
   */
  async getTaskStats(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = uuidSchema.parse(req.params.id);
      const userId = req.user!.id;
      const isAdmin = req.user!.role === Role.ADMIN;

      const stats = await taskService.getTaskStats(taskId, userId, isAdmin);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid task ID',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message === 'Task not found') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      if (
        error instanceof Error &&
        error.message === 'No permission to view this task'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message,
        });
      }

      next(error);
    }
  }
}

export const taskController = new TaskController();
