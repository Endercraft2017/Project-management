/**
 * User Management Service
 * Business logic for user operations
 */

import { prisma } from '@/database/client';
import { Role } from '@prisma/client';
import { ListUsersQuery, UpdateUserInput, UpdateRoleInput } from './validators';

export class UserService {
  /**
   * List users with filtering, sorting, and pagination
   */
  async listUsers(query: ListUsersQuery) {
    const { page, limit, role, isActive, search, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (role !== undefined) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID with stats
   */
  async getUserById(userId: string, includeStats = false) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    if (includeStats) {
      const stats = await this.getUserStats(userId);
      return { ...user, stats };
    }

    return user;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    const [tasksAssigned, tasksCreated, conversations, messagesSent] = await Promise.all([
      prisma.task.count({
        where: { assignedToId: userId },
      }),
      prisma.task.count({
        where: { createdById: userId },
      }),
      prisma.conversationMember.count({
        where: { userId },
      }),
      prisma.message.count({
        where: { senderId: userId },
      }),
    ]);

    // Calculate completed tasks (100% progress)
    const tasksCompleted = await prisma.task.count({
      where: {
        assignedToId: userId,
        progress: 100,
      },
    });

    // Calculate average task progress
    const tasks = await prisma.task.findMany({
      where: { assignedToId: userId },
      select: { progress: true },
    });

    const avgTaskProgress =
      tasks.length > 0
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
        : 0;

    return {
      tasksAssigned,
      tasksCreated,
      tasksCompleted,
      avgTaskProgress,
      conversations,
      messagesSent,
    };
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: UpdateUserInput) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, data: UpdateRoleInput) {
    return await prisma.user.update({
      where: { id: userId },
      data: { role: data.role },
      select: {
        id: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  /**
   * Activate user
   */
  async activateUser(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }
}

export const userService = new UserService();
