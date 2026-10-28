/**
 * Weekly Summaries Service
 * Business logic for generating and managing AI-powered weekly summaries
 */

import { ImpactLevel, Prisma } from "@prisma/client";
import prisma from "@/database/client";
import { openAIService } from "@/services/openai.service";
import type { DailyUpdateData } from "@/services/openai.service";
import { adminSettingsService } from "@/admin/settings.service";

/**
 * Get the Monday and Sunday dates for a given week
 */
function getWeekBounds(date: Date): { monday: Date; sunday: Date } {
  const current = new Date(date);
  const dayOfWeek = current.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0) or other days

  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

/**
 * Format date as YYYY-MM-DD for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export class WeeklySummariesService {
  /**
   * Generate weekly summaries for all team members for a given week
   * This is the main function that orchestrates the summary generation
   */
  async generateWeeklySummary(weekDate: Date) {
    openAIService.assertEnabled();
    const { monday, sunday } = getWeekBounds(weekDate);

    // Check if summary already exists for this week
    const existing = await prisma.weeklySummary.findUnique({
      where: {
        weekStartDate_weekEndDate: {
          weekStartDate: monday,
          weekEndDate: sunday,
        },
      },
    });

    if (existing) {
      throw new Error(
        `Weekly summary already exists for week ${formatDate(monday)} to ${formatDate(sunday)}`,
      );
    }

    // Get member selection configuration
    const membersConfig =
      await adminSettingsService.getWeeklySummaryMembersConfig();

    // Get users based on configuration
    let users;
    if (membersConfig && membersConfig.includedUserIds.length > 0) {
      // Get only selected users
      users = await prisma.user.findMany({
        where: {
          id: { in: membersConfig.includedUserIds },
          isActive: true,
        },
        take: 51,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    } else {
      // Default: Get all active users (backwards compatible)
      users = await prisma.user.findMany({
        where: { isActive: true },
        take: 51,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    }

    if (users.length > 50)
      throw new Error("Select at most 50 members for one generation");

    // Get all daily updates for the week (from Monday up to today, not future dates)
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999); // End of today
    const endDate = today < sunday ? today : sunday; // Use whichever is earlier

    const updates = await prisma.dailyUpdate.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
        date: {
          gte: monday,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ userId: "asc" }, { date: "asc" }],
      take: 715,
    });

    if (updates.length >= 715)
      throw new Error("Too many updates for bounded summary generation");

    // Group updates by user
    const updatesByUser = new Map<string, DailyUpdateData[]>();
    updates.forEach((update) => {
      const userUpdates = updatesByUser.get(update.userId) || [];
      userUpdates.push({
        date: formatDate(update.date),
        content: update.content,
      });
      updatesByUser.set(update.userId, userUpdates);
    });

    const eligible = users.filter(
      (user) => (updatesByUser.get(user.id) || []).length > 0,
    );
    if (eligible.length === 0)
      throw new Error("No submitted updates are available for AI summary");
    if (eligible.length > 50)
      throw new Error("Select at most 50 members for one generation");
    // Sequential provider calls respect per-tenant concurrency. Never persist a fake LOW result.
    const generated: Array<{
      userId: string;
      result: Awaited<ReturnType<typeof openAIService.generateWeeklySummary>>;
      updates: DailyUpdateData[];
    }> = [];
    for (const user of eligible) {
      const userUpdates = updatesByUser.get(user.id)!;
      const result = await openAIService.generateWeeklySummary(
        user.name,
        userUpdates,
      );
      generated.push({ userId: user.id, result, updates: userUpdates });
    }
    // All-or-nothing persistence; provider failure leaves no partial/placeholder summary.
    return prisma.$transaction(async (tx) => {
      const weeklySummary = await tx.weeklySummary.create({
        data: { weekStartDate: monday, weekEndDate: sunday },
      });
      const memberSummaries = [];
      for (const item of generated)
        memberSummaries.push(
          await tx.memberWeeklySummary.create({
            data: {
              weeklySummaryId: weeklySummary.id,
              userId: item.userId,
              summary: item.result.summary,
              impactLevel: item.result.impact.level as ImpactLevel,
              rawUpdates: {
                updates: item.updates,
                reasoning: item.result.impact.reasoning,
              } as unknown as Prisma.InputJsonValue,
            },
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          }),
        );
      return { ...weeklySummary, memberSummaries };
    });
  }

  /**
   * Get a weekly summary by week dates
   */
  async getWeeklySummary(weekDate: Date) {
    const { monday, sunday } = getWeekBounds(weekDate);

    const summary = await prisma.weeklySummary.findUnique({
      where: {
        weekStartDate_weekEndDate: {
          weekStartDate: monday,
          weekEndDate: sunday,
        },
      },
      include: {
        memberSummaries: {
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
          orderBy: [
            { impactLevel: "asc" }, // HIGH first (alphabetically first)
            { user: { name: "asc" } },
          ],
        },
      },
    });

    return summary;
  }

  /**
   * List all available weekly summaries
   */
  async listWeeklySummaries(limit = 10, offset = 0) {
    const summaries = await prisma.weeklySummary.findMany({
      orderBy: { weekStartDate: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { memberSummaries: true },
        },
      },
    });

    const total = await prisma.weeklySummary.count();

    return {
      summaries,
      total,
      limit,
      offset,
    };
  }

  /**
   * Delete a weekly summary
   * Admin only - cascade delete will remove all member summaries
   */
  async deleteWeeklySummary(summaryId: string) {
    await prisma.weeklySummary.delete({
      where: { id: summaryId },
    });

    return { success: true };
  }

  /**
   * Get member summaries for a specific week, grouped by impact level
   */
  async getGroupedMemberSummaries(weekDate: Date) {
    const summary = await this.getWeeklySummary(weekDate);

    if (!summary) {
      return null;
    }

    const grouped = {
      high: summary.memberSummaries.filter((s) => s.impactLevel === "HIGH"),
      medium: summary.memberSummaries.filter((s) => s.impactLevel === "MEDIUM"),
      low: summary.memberSummaries.filter((s) => s.impactLevel === "LOW"),
    };

    return {
      id: summary.id,
      weekStartDate: summary.weekStartDate,
      weekEndDate: summary.weekEndDate,
      generatedAt: summary.generatedAt,
      emailSentAt: summary.emailSentAt,
      grouped,
      stats: {
        total: summary.memberSummaries.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
      },
    };
  }

  /**
   * Mark a weekly summary as emailed
   */
  async markAsEmailed(summaryId: string) {
    return prisma.weeklySummary.update({
      where: { id: summaryId },
      data: { emailSentAt: new Date() },
    });
  }
}

export const weeklySummariesService = new WeeklySummariesService();
