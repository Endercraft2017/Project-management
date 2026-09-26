/**
 * User Management Validators
 * Zod schemas for validating user-related requests
 */

import { z } from 'zod';
import { Role } from '@prisma/client';

/**
 * Query parameters for listing users
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(Role).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(100).trim().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/**
 * Update user profile schema
 */
export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Update user role schema
 */
export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/**
 * UUID parameter validation
 */
export const uuidSchema = z.string().uuid('Invalid user ID');
