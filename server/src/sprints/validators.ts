/**
 * Sprint Management Validators
 * Zod schemas for input validation
 */

import { z } from 'zod';

/**
 * UUID validation schema (reusable)
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * List sprints query parameters
 */
export const listSprintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
  includeStats: z.coerce.boolean().default(false),
  sortBy: z.enum(['startDate', 'endDate', 'createdAt']).default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListSprintsQuery = z.infer<typeof listSprintsQuerySchema>;

/**
 * Create sprint request body
 */
export const createSprintSchema = z
  .object({
    name: z.string().min(1, 'Sprint name is required').max(100).trim(),
    startDate: z.coerce.date({
      required_error: 'Start date is required',
      invalid_type_error: 'Invalid start date format',
    }),
    endDate: z.coerce.date({
      required_error: 'End date is required',
      invalid_type_error: 'Invalid end date format',
    }),
    goal: z.string().max(1000).trim().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

export type CreateSprint = z.infer<typeof createSprintSchema>;

/**
 * Update sprint request body
 */
export const updateSprintSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    goal: z.string().max(1000).trim().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // If both dates provided, validate their relationship
      if (data.startDate && data.endDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required for update',
  });

export type UpdateSprint = z.infer<typeof updateSprintSchema>;

/**
 * Get sprint tasks query parameters
 */
export const getSprintTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetSprintTasksQuery = z.infer<typeof getSprintTasksQuerySchema>;

/**
 * Delete sprint query parameters
 */
export const deleteSprintQuerySchema = z.object({
  moveTasksToBacklog: z.coerce.boolean().default(true),
  deleteTasks: z.coerce.boolean().default(false), // If true, deletes all tasks instead of moving to backlog
});

export type DeleteSprintQuery = z.infer<typeof deleteSprintQuerySchema>;

/**
 * Get sprint by ID query parameters
 */
export const getSprintQuerySchema = z.object({
  includeTasks: z.coerce.boolean().default(false),
});

export type GetSprintQuery = z.infer<typeof getSprintQuerySchema>;
