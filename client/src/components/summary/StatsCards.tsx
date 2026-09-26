/**
 * Statistics Cards Component
 * Displays key metrics in card format
 */

import { ListTodo, CheckCircle2, TrendingUp, AlertCircle, Clock, Circle } from 'lucide-react';

interface StatsCardsProps {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  overdueTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4 md:p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 sm:mt-2 text-xl sm:text-2xl md:text-3xl font-bold">{value}</p>
        </div>
        <div className={`rounded-full p-2 sm:p-2.5 md:p-3 flex-shrink-0 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function StatsCards({
  totalTasks,
  completedTasks,
  completionPercentage,
  overdueTasks,
  inProgressTasks,
  notStartedTasks,
}: StatsCardsProps) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="Total Tasks"
        value={totalTasks}
        icon={<ListTodo className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />}
        color="bg-blue-100 dark:bg-blue-900"
      />
      <StatCard
        title="Completed"
        value={completedTasks}
        icon={<CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />}
        color="bg-green-100 dark:bg-green-900"
      />
      <StatCard
        title="Completion Rate"
        value={`${completionPercentage}%`}
        icon={<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />}
        color="bg-purple-100 dark:bg-purple-900"
      />
      <StatCard
        title="Overdue"
        value={overdueTasks}
        icon={<AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />}
        color="bg-red-100 dark:bg-red-900"
      />
      <StatCard
        title="In Progress"
        value={inProgressTasks}
        icon={<Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />}
        color="bg-orange-100 dark:bg-orange-900"
      />
      <StatCard
        title="Not Started"
        value={notStartedTasks}
        icon={<Circle className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />}
        color="bg-gray-100 dark:bg-gray-800"
      />
    </div>
  );
}
