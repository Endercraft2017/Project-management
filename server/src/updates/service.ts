/**
 * Daily Updates Service
 * Business logic for daily team updates
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/database/client';
import { getSocketServer } from '@/chat/socket-server';

export class UpdatesService {
  /**
   * List all unique days that have updates (for sidebar)
   * Returns dates in descending order (newest first)
   */
  async listDays() {
    const updates = await prisma.dailyUpdate.findMany({
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
    });

    return updates.map((u) => u.date);
  }

  /**
   * Get all updates for a specific day
   * Returns updates with user information
   */
  async getDayUpdates(date: Date) {
    const updates = await prisma.dailyUpdate.findMany({
      where: {
        date: new Date(date.toISOString().split('T')[0]), // Normalize to date only
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return updates;
  }

  /**
   * Create or update user's daily update for a specific date
   * Each user can only have one update per day
   */
  async createOrUpdateUpdate(userId: string, date: Date, content: string) {
    const normalizedDate = new Date(date.toISOString().split('T')[0]);

    // Upsert: create if doesn't exist, update if exists
    const update = await prisma.dailyUpdate.upsert({
      where: {
        userId_date: {
          userId,
          date: normalizedDate,
        },
      },
      update: {
        content,
        updatedAt: new Date(),
      },
      create: {
        userId,
        date: normalizedDate,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Emit WebSocket event for real-time updates
    const io = getSocketServer();
    if (io) {
      io.emit('daily_update_changed', {
        date: normalizedDate,
        update,
      });

      // Notify admins when a member posts an update
      if (update.user.role !== 'ADMIN') {
        // Get all admin users
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true },
        });

        // Emit notification to each admin's personal room
        admins.forEach((admin) => {
          io.to(`user:${admin.id}`).emit('member_daily_update', {
            updateId: update.id,
            date: normalizedDate,
            userId: update.userId,
            userName: update.user.name,
            content: update.content.substring(0, 100), // Preview
          });
        });
      }
    }

    return update;
  }

  /**
   * Delete a daily update
   * Only the user who created it can delete it
   */
  async deleteUpdate(updateId: string, userId: string) {
    // First check if the update exists and belongs to the user
    const existing = await prisma.dailyUpdate.findUnique({
      where: { id: updateId },
    });

    if (!existing) {
      throw new Error('Update not found');
    }

    if (existing.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own updates');
    }

    await prisma.dailyUpdate.delete({
      where: { id: updateId },
    });

    // Emit WebSocket event
    const io = getSocketServer();
    if (io) {
      io.emit('daily_update_changed', {
        date: existing.date,
        deletedId: updateId,
      });
    }

    return { success: true };
  }

  /**
   * Get user's update for a specific date
   */
  async getUserUpdateForDate(userId: string, date: Date) {
    const normalizedDate = new Date(date.toISOString().split('T')[0]);

    const update = await prisma.dailyUpdate.findUnique({
      where: {
        userId_date: {
          userId,
          date: normalizedDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return update;
  }

  /**
   * Get team members who haven't submitted updates for a specific date
   * Returns list of users who have not posted their daily update
   */
  async getMissingMembersForDate(date: Date) {
    const normalizedDate = new Date(date.toISOString().split('T')[0]);

    // Get all active users
    const allUsers = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    // Get users who have submitted updates for this date
    const submittedUpdates = await prisma.dailyUpdate.findMany({
      where: {
        date: normalizedDate,
      },
      select: {
        userId: true,
      },
    });

    const submittedUserIds = new Set(submittedUpdates.map((u) => u.userId));

    // Filter out users who have already submitted
    const missingMembers = allUsers.filter((user) => !submittedUserIds.has(user.id));

    return missingMembers;
  }
}

export const updatesService = new UpdatesService();
