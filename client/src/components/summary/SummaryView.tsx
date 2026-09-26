/**
 * Summary View Component
 * Main dashboard with statistics and charts
 */

import { RefreshCw } from 'lucide-react';
import { useSummaryStatistics } from '@/hooks/useStatistics';
import { useCurrentUser } from '@/hooks/useUsers';
import StatsCards from './StatsCards';
import TasksBySprintChart from './TasksBySprintChart';
import TasksByUserChart from './TasksByUserChart';
import ProgressChart from './ProgressChart';
import CompletionTrendChart from './CompletionTrendChart';

export default function SummaryView() {
  const { data: stats, isLoading, isError, refetch } = useSummaryStatistics();
  const { data: currentUser } = useCurrentUser();

  const isAdmin = currentUser?.role === 'ADMIN';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">
            Failed to load statistics. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Summary Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Overview of project progress and team workload
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 sm:px-4 py-2 text-sm hover:bg-accent self-start sm:self-auto"
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <StatsCards
        totalTasks={stats.totalTasks}
        completedTasks={stats.completedTasks}
        completionPercentage={stats.completionPercentage}
        overdueTasks={stats.overdueTasks}
        inProgressTasks={stats.inProgressTasks}
        notStartedTasks={stats.notStartedTasks}
      />

      {/* Charts Grid - Mobile: Vertical Stack, Desktop: 2 Columns */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Tasks by Sprint */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Tasks by Sprint</h2>
          <div className="h-64 sm:h-80">
            <TasksBySprintChart data={stats.tasksBySprint} />
          </div>
        </div>

        {/* Tasks by User - Admin Only */}
        {isAdmin && (
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
            <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Team Workload</h2>
            <div className="h-64 sm:h-80">
              <TasksByUserChart data={stats.tasksByUser} />
            </div>
          </div>
        )}

        {/* Progress Distribution */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Progress Distribution</h2>
          <div className="h-64 sm:h-80">
            <ProgressChart data={stats.progressDistribution} />
          </div>
        </div>

        {/* Completion Trend */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">
            30-Day Completion Trend
          </h2>
          <div className="h-64 sm:h-80">
            <CompletionTrendChart data={stats.completionTrend} />
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">Insights</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">Active Sprints</p>
            <p className="mt-1 text-2xl font-bold">
              {stats.tasksBySprint.length}
            </p>
          </div>
          {isAdmin && (
            <>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats.tasksByUser.length}
                </p>
              </div>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm text-muted-foreground">Avg. Tasks per User</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats.tasksByUser.length > 0
                    ? Math.round(
                        stats.totalTasks / stats.tasksByUser.length
                      )
                    : 0}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
