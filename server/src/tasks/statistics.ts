/**
 * Task Statistics Service
 * Aggregates task data for summary dashboard
 */

import prisma from '../database/client';
import { startOfDay, subDays } from 'date-fns';

interface SummaryStatistics {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  overdueTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  tasksBySprint: Array<{
    sprintId: string;
    sprintName: string;
    taskCount: number;
    completedCount: number;
    completionPercentage: number;
  }>;
  tasksByUser: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    assignedCount: number;
    completedCount: number;
    completionPercentage: number;
  }>;
  progressDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  completionTrend: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
}

/**
 * Get summary statistics for dashboard
 */
export async function getSummaryStatistics(): Promise<SummaryStatistics> {
  // Get total counts
  const totalTasks = await prisma.task.count();

  const completedTasks = await prisma.task.count({
    where: { progress: 100 },
  });

  const now = new Date();
  const overdueTasks = await prisma.task.count({
    where: {
      deadline: { lt: now },
      progress: { lt: 100 },
    },
  });

  const inProgressTasks = await prisma.task.count({
    where: {
      progress: { gt: 0, lt: 100 },
    },
  });

  const notStartedTasks = await prisma.task.count({
    where: { progress: 0 },
  });

  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Tasks by Sprint
  const sprintsWithTasks = await prisma.sprint.findMany({
    select: {
      id: true,
      name: true,
      tasks: {
        select: {
          id: true,
          progress: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
    take: 10, // Limit to 10 most recent sprints
  });

  const tasksBySprint = sprintsWithTasks.map((sprint) => {
    const taskCount = sprint.tasks.length;
    const completedCount = sprint.tasks.filter((t) => t.progress === 100).length;
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      taskCount,
      completedCount,
      completionPercentage:
        taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
    };
  });

  // Tasks by User (exclude admins from workload view)
  const usersWithTasks = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: 'ADMIN' }, // Exclude admins from team workload
    },
    select: {
      id: true,
      name: true,
      email: true,
      assignedTasks: {
        select: {
          id: true,
          progress: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const tasksByUser = usersWithTasks.map((user) => {
    const assignedCount = user.assignedTasks.length;
    const completedCount = user.assignedTasks.filter(
      (t) => t.progress === 100
    ).length;
    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      assignedCount,
      completedCount,
      completionPercentage:
        assignedCount > 0
          ? Math.round((completedCount / assignedCount) * 100)
          : 0,
    };
  });

  // Progress Distribution (0-20%, 21-40%, 41-60%, 61-80%, 81-99%, 100%)
  const progressRanges = [
    { range: '0-20%', min: 0, max: 20 },
    { range: '21-40%', min: 21, max: 40 },
    { range: '41-60%', min: 41, max: 60 },
    { range: '61-80%', min: 61, max: 80 },
    { range: '81-99%', min: 81, max: 99 },
    { range: '100%', min: 100, max: 100 },
  ];

  const progressDistribution = await Promise.all(
    progressRanges.map(async ({ range, min, max }) => {
      const count = await prisma.task.count({
        where: {
          progress: { gte: min, lte: max },
        },
      });
      return {
        range,
        count,
        percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
      };
    })
  );

  // Completion Trend (last 30 days)
  const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));

  // Get tasks completed in last 30 days
  const completedTasksByDay = await prisma.task.groupBy({
    by: ['updatedAt'],
    where: {
      progress: 100,
      updatedAt: { gte: thirtyDaysAgo },
    },
    _count: {
      id: true,
    },
  });

  // Get tasks created in last 30 days
  const createdTasksByDay = await prisma.task.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: {
      id: true,
    },
  });

  // Aggregate by day
  const trendMap = new Map<string, { completed: number; created: number }>();

  for (let i = 0; i < 30; i++) {
    const date = startOfDay(subDays(new Date(), i));
    const dateStr = date.toISOString().split('T')[0];
    trendMap.set(dateStr, { completed: 0, created: 0 });
  }

  completedTasksByDay.forEach((group) => {
    const dateStr = startOfDay(new Date(group.updatedAt))
      .toISOString()
      .split('T')[0];
    const existing = trendMap.get(dateStr);
    if (existing) {
      existing.completed += group._count.id;
    }
  });

  createdTasksByDay.forEach((group) => {
    const dateStr = startOfDay(new Date(group.createdAt))
      .toISOString()
      .split('T')[0];
    const existing = trendMap.get(dateStr);
    if (existing) {
      existing.created += group._count.id;
    }
  });

  const completionTrend = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      created: data.created,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalTasks,
    completedTasks,
    completionPercentage,
    overdueTasks,
    inProgressTasks,
    notStartedTasks,
    tasksBySprint,
    tasksByUser,
    progressDistribution,
    completionTrend,
  };
}
