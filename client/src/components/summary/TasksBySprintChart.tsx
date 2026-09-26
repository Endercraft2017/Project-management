/**
 * Tasks by Sprint Chart
 * Bar chart showing task distribution across sprints
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TasksBySprintData {
  sprintId: string;
  sprintName: string;
  taskCount: number;
  completedCount: number;
  completionPercentage: number;
}

interface TasksBySprintChartProps {
  data: TasksBySprintData[];
}

export default function TasksBySprintChart({ data }: TasksBySprintChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No sprint data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="sprintName"
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Bar
          dataKey="taskCount"
          fill="hsl(var(--primary))"
          name="Total Tasks"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="completedCount"
          fill="hsl(142.1 76.2% 36.3%)"
          name="Completed"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
