/**
 * TanStack Query Hooks for Statistics
 */

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';

export const statisticsKeys = {
  all: ['statistics'] as const,
  summary: () => [...statisticsKeys.all, 'summary'] as const,
};

export interface SummaryStatistics {
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
 * Fetch summary statistics
 */
export function useSummaryStatistics() {
  return useQuery({
    queryKey: statisticsKeys.summary(),
    queryFn: () => get<SummaryStatistics>('/api/tasks/statistics/summary'),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
