/**
 * Task Management Validators
 * Zod schemas for input validation
 */

import { z } from 'zod';

/**
 * UUID validation schema (reusable)
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * List tasks query parameters
 */
export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  sprintId: z.string().uuid().optional(),
  assignedToId: z.union([z.string().uuid(), z.literal('null')]).optional(),
  createdById: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  nestingLevel: z.coerce.number().int().min(0).max(3).optional(),
  minProgress: z.coerce.number().int().min(0).max(100).optional(),
  maxProgress: z.coerce.number().int().min(0).max(100).optional(),
  includeSubtasks: z.coerce.boolean().default(false),
  sortBy: z
    .enum(['createdAt', 'deadline', 'progress', 'taskName'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

/**
 * Create task request body
 */
export const createTaskSchema = z
  .object({
    taskName: z
      .string()
      .min(1, 'Task name is required')
      .max(200, 'Task name must be at most 200 characters')
      .trim(),
    details: z.string().max(5000).trim().optional(),
    startDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    sprintId: z.string().uuid('Invalid sprint ID').optional(),
    sprintName: z.string().trim().optional(), // For creating new sprint
    assignedToId: z.string().uuid('Invalid user ID').optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
  })
  .refine(
    (data) => {
      // If both dates provided, validate their relationship
      if (data.startDate && data.deadline) {
        return data.deadline > data.startDate;
      }
      return true;
    },
    {
      message: 'Due date must be after start date',
      path: ['dueDate'],
    }
  );

export type CreateTask = z.infer<typeof createTaskSchema>;

/**
 * Update task request body
 */
export const updateTaskSchema = z
  .object({
    taskName: z.string().min(1).max(200).trim().optional(),
    details: z.string().max(5000).trim().optional(),
    startDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    sprintId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
    parentTaskId: z.string().uuid().optional().nullable(),
    progress: z.coerce.number().min(0).max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.deadline) {
        return data.deadline > data.startDate;
      }
      return true;
    },
    {
      message: 'Due date must be after start date',
      path: ['dueDate'],
    }
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

export type UpdateTask = z.infer<typeof updateTaskSchema>;

/**
 * Move to sprint request body
 */
export const moveToSprintSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID').nullable(),
});

export type MoveToSprint = z.infer<typeof moveToSprintSchema>;

/**
 * Delete task query parameters
 */
export const deleteTaskQuerySchema = z.object({
  cascade: z.coerce.boolean().default(true),
});

export type DeleteTaskQuery = z.infer<typeof deleteTaskQuerySchema>;

/**
 * Get task query parameters
 */
export const getTaskQuerySchema = z.object({
  includeSubtasks: z.coerce.boolean().default(false),
  includeParent: z.coerce.boolean().default(false),
});

export type GetTaskQuery = z.infer<typeof getTaskQuerySchema>;
