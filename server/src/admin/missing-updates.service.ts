/**
 * Missing Updates Service
 * Detects users who haven't submitted daily updates
 */

import prisma from '@/database/client';
import { adminSettingsService } from './settings.service';

export interface MissingUpdate {
  userId: string;
  userName: string;
  userEmail: string;
  missingDates: string[]; // YYYY-MM-DD format
}

export interface MissingUpdatesResult {
  users: MissingUpdate[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalUsers: number;
  totalMissingDays: number;
}

export class MissingUpdatesService {
  /**
   * Check if a date is a business day (Monday-Friday)
   */
  private isBusinessDay(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday = 1, Friday = 5
  }

  /**
   * Get all dates in range that should have updates
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @param businessDaysOnly - Only include Monday-Friday
   */
  private getDatesInRange(
    startDate: Date,
    endDate: Date,
    businessDaysOnly: boolean
  ): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      if (!businessDaysOnly || this.isBusinessDay(current)) {
        dates.push(new Date(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * Calculate date range based on configuration
   */
  private calculateDateRange(
    rangeType: 'current_week' | 'last_7_days' | 'last_14_days' | 'last_30_days',
    customStart?: Date,
    customEnd?: Date
  ): { startDate: Date; endDate: Date } {
    if (customStart && customEnd) {
      return {
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      };
    }

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(now);

    let startDate: Date;

    switch (rangeType) {
      case 'current_week': {
        // Get Monday of current week
        const dayOfWeek = now.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
        startDate = new Date(now);
        startDate.setUTCDate(now.getUTCDate() - daysToMonday);
        break;
      }
      case 'last_7_days': {
        startDate = new Date(now);
        startDate.setUTCDate(now.getUTCDate() - 6); // 7 days including today
        break;
      }
      case 'last_14_days': {
        startDate = new Date(now);
        startDate.setUTCDate(now.getUTCDate() - 13); // 14 days including today
        break;
      }
      case 'last_30_days': {
        startDate = new Date(now);
        startDate.setUTCDate(now.getUTCDate() - 29); // 30 days including today
        break;
      }
    }

    return { startDate, endDate };
  }

  /**
   * Get users with missing updates
   * @param customStartDate - Optional custom start date (YYYY-MM-DD)
   * @param customEndDate - Optional custom end date (YYYY-MM-DD)
   */
  async getMissingUpdates(
    customStartDate?: string,
    customEndDate?: string
  ): Promise<MissingUpdatesResult> {
    // Get configuration
    const config = await adminSettingsService.getMissingUpdatesConfig();

    // Default configuration if not set
    const checkBusinessDaysOnly = config?.checkBusinessDaysOnly ?? true;
    const defaultDateRange = config?.defaultDateRange ?? 'current_week';

    // Use weekly summary members config for member selection (shared across features)
    const membersConfig = await adminSettingsService.getWeeklySummaryMembersConfig();
    const includedUserIds = membersConfig?.includedUserIds ?? [];

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(
      defaultDateRange,
      customStartDate ? new Date(customStartDate) : undefined,
      customEndDate ? new Date(customEndDate) : undefined
    );

    // Get all dates that should have updates
    const expectedDates = this.getDatesInRange(
      startDate,
      endDate,
      checkBusinessDaysOnly
    );

    // Get users to check (based on configuration)
    let usersToCheck;
    if (includedUserIds.length > 0) {
      // Only check included users
      usersToCheck = await prisma.user.findMany({
        where: {
          id: { in: includedUserIds },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: 'asc' },
      });
    } else {
      // Check all active users (excluding admins if not included)
      usersToCheck = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    // Get all updates in the date range
    const updates = await prisma.dailyUpdate.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        userId: { in: usersToCheck.map((u) => u.id) },
      },
      select: {
        userId: true,
        date: true,
      },
    });

    // Create a map of user updates for quick lookup
    const updateMap = new Map<string, Set<string>>();
    updates.forEach((update) => {
      const userId = update.userId;
      const dateStr = update.date.toISOString().split('T')[0];

      if (!updateMap.has(userId)) {
        updateMap.set(userId, new Set());
      }
      updateMap.get(userId)!.add(dateStr);
    });

    // Find missing updates for each user
    const usersWithMissingUpdates: MissingUpdate[] = [];
    let totalMissingDays = 0;

    for (const user of usersToCheck) {
      const userUpdates = updateMap.get(user.id) || new Set();
      const missingDates: string[] = [];

      for (const expectedDate of expectedDates) {
        const dateStr = expectedDate.toISOString().split('T')[0];
        if (!userUpdates.has(dateStr)) {
          missingDates.push(dateStr);
        }
      }

      if (missingDates.length > 0) {
        usersWithMissingUpdates.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          missingDates,
        });
        totalMissingDays += missingDates.length;
      }
    }

    return {
      users: usersWithMissingUpdates,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      totalUsers: usersWithMissingUpdates.length,
      totalMissingDays,
    };
  }

  /**
   * Get missing dates for a specific user
   * @param userId - User ID
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   */
  async getUserMissingDates(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const config = await adminSettingsService.getMissingUpdatesConfig();
    const checkBusinessDaysOnly = config?.checkBusinessDaysOnly ?? true;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all expected dates
    const expectedDates = this.getDatesInRange(start, end, checkBusinessDaysOnly);

    // Get user's updates in range
    const updates = await prisma.dailyUpdate.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      select: {
        date: true,
      },
    });

    const updateDates = new Set(
      updates.map((u) => u.date.toISOString().split('T')[0])
    );

    // Find missing dates
    const missingDates: string[] = [];
    for (const expectedDate of expectedDates) {
      const dateStr = expectedDate.toISOString().split('T')[0];
      if (!updateDates.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }

    return missingDates;
  }
}

export const missingUpdatesService = new MissingUpdatesService();
