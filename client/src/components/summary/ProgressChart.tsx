/**
 * Progress Distribution Chart
 * Pie chart showing task progress ranges
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface ProgressData {
  range: string;
  count: number;
  percentage: number;
}

interface ProgressChartProps {
  data: ProgressData[];
}

const COLORS = [
  '#ef4444', // red - 0-20%
  '#f97316', // orange - 21-40%
  '#eab308', // yellow - 41-60%
  '#3b82f6', // blue - 61-80%
  '#8b5cf6', // purple - 81-99%
  '#22c55e', // green - 100%
];

export default function ProgressChart({ data }: ProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No progress data available
      </div>
    );
  }

  // Filter out ranges with 0 count
  const filteredData = data.filter((item) => item.count > 0);

  if (filteredData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No tasks to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={filteredData}
          dataKey="count"
          nameKey="range"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ range, percentage }) => `${range} (${percentage}%)`}
          labelLine={true}
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
