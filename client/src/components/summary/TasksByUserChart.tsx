/**
 * Tasks by User Chart
 * Bar chart showing workload distribution across team members
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

interface TasksByUserData {
  userId: string;
  userName: string;
  assignedCount: number;
  completedCount: number;
  completionPercentage: number;
}

interface TasksByUserChartProps {
  data: TasksByUserData[];
}

export default function TasksByUserChart({ data }: TasksByUserChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No user data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="userName"
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          angle={-45}
          textAnchor="end"
          height={80}
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
          dataKey="assignedCount"
          fill="hsl(var(--primary))"
          name="Assigned"
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
