# Feature 10: Summary View - Implementation Plan

**Feature**: Summary Dashboard with Charts
**Estimated Effort**: 4-6 hours
**Dependencies**: Feature 9 (Frontend Setup)
**Priority**: High

## Research Summary

### Recharts 3.0 (2025)
- **Latest Version**: 3.0+ with major improvements
- **Key Features**:
  - Enhanced accessibility (ARIA labels, keyboard navigation)
  - Better animations with smoother transitions
  - Improved TypeScript support
  - Auto-sizing axes
  - Tooltip enhancements
- **Best For**: Small to medium datasets, dashboards, SaaS applications
- **Performance**: Limit data points for time series (every 10th point or averages)

### Chart Types Available in Recharts
1. **BarChart**: For comparing categories
2. **LineChart**: For trends over time
3. **AreaChart**: For cumulative data
4. **PieChart**: For proportions
5. **RadarChart**: For multi-dimensional data

### Best Practices (2025)
1. **Component-Based**: Use Recharts' React component API
2. **Responsive**: Use ResponsiveContainer for automatic sizing
3. **Accessibility**: Include ARIA labels and descriptions
4. **Performance**: Limit data points to 100-200 for smooth rendering
5. **Color Palette**: Use consistent colors matching Tailwind theme
6. **Tooltips**: Provide detailed hover information
7. **Loading States**: Show skeleton loaders while data fetches

## Feature Overview

The Summary View provides a dashboard with visualizations for:
- Tasks by Sprint (Bar Chart)
- Tasks by User (Bar Chart)
- Progress Distribution (Pie Chart)
- Sprint Timeline (Area Chart)
- Task Completion Trend (Line Chart)
- Statistics Cards (Total tasks, completion %, overdue tasks)

## Technology Stack

### Libraries
- **Recharts 3.x**: Chart library
- **TanStack Query**: Data fetching
- **Date-fns**: Date formatting
- **Lucide React**: Icons

### Components Structure
```
client/src/components/summary/
├── SummaryView.tsx          # Main dashboard container
├── StatsCards.tsx           # Statistics cards component
├── TasksBySprintChart.tsx   # Bar chart for sprint distribution
├── TasksByUserChart.tsx     # Bar chart for user workload
├── ProgressChart.tsx        # Pie chart for progress distribution
├── TimelineChart.tsx        # Area chart for sprint timeline
└── CompletionTrendChart.tsx # Line chart for completion trend
```

## Implementation Steps

### Step 1: Create API Hooks for Statistics

Create `client/src/hooks/useStatistics.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';

export const statisticsKeys = {
  all: ['statistics'] as const,
  summary: () => [...statisticsKeys.all, 'summary'] as const,
};

interface SummaryStatistics {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  overdueTasks: number;
  tasksBySprint: Array<{
    sprintName: string;
    taskCount: number;
    completedCount: number;
  }>;
  tasksByUser: Array<{
    userName: string;
    assignedCount: number;
    completedCount: number;
  }>;
  progressDistribution: Array<{
    range: string;
    count: number;
  }>;
  completionTrend: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
}

export function useSummaryStatistics() {
  return useQuery({
    queryKey: statisticsKeys.summary(),
    queryFn: () => get<SummaryStatistics>('/api/tasks/statistics/summary'),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
```

### Step 2: Create Statistics Cards Component

```typescript
interface StatsCardsProps {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  overdueTasks: number;
}

export default function StatsCards({
  totalTasks,
  completedTasks,
  completionPercentage,
  overdueTasks,
}: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Tasks"
        value={totalTasks}
        icon={<ListTodo />}
      />
      <StatsCard
        title="Completed"
        value={completedTasks}
        icon={<CheckCircle />}
      />
      <StatsCard
        title="Completion Rate"
        value={`${completionPercentage}%`}
        icon={<TrendingUp />}
      />
      <StatsCard
        title="Overdue"
        value={overdueTasks}
        icon={<AlertCircle />}
      />
    </div>
  );
}
```

### Step 3: Create Bar Chart for Tasks by Sprint

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TasksBySprintChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="sprintName" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="taskCount" fill="hsl(var(--primary))" name="Total Tasks" />
        <Bar dataKey="completedCount" fill="hsl(var(--accent))" name="Completed" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Step 4: Create Pie Chart for Progress Distribution

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

export default function ProgressChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="range"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### Step 5: Create Main Summary View

```typescript
export default function SummaryView() {
  const { data: stats, isLoading, isError } = useSummaryStatistics();

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Summary Dashboard</h1>

      <StatsCards {...stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Sprint</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksBySprintChart data={stats.tasksBySprint} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks by User</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksByUserChart data={stats.tasksByUser} />
          </CardContent>
        </Card>
      </div>

      {/* More charts... */}
    </div>
  );
}
```

## Backend API Endpoint

Create `/api/tasks/statistics/summary` endpoint in backend:

```typescript
// server/src/tasks/controller.ts
export async function getSummaryStatistics(req: Request, res: Response) {
  const totalTasks = await prisma.task.count();
  const completedTasks = await prisma.task.count({
    where: { progress: 100 },
  });
  const overdueTasks = await prisma.task.count({
    where: { deadline: { lt: new Date() }, progress: { lt: 100 } },
  });

  const tasksBySprint = await prisma.sprint.findMany({
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
      tasks: {
        where: { progress: 100 },
        select: { id: true },
      },
    },
  });

  // ... more aggregations

  res.json({
    success: true,
    data: {
      totalTasks,
      completedTasks,
      completionPercentage: Math.round((completedTasks / totalTasks) * 100),
      overdueTasks,
      tasksBySprint,
      tasksByUser,
      progressDistribution,
      completionTrend,
    },
  });
}
```

## Color Palette (Tailwind CSS Variables)

```css
--chart-1: 221.2 83.2% 53.3%;  /* Primary blue */
--chart-2: 142.1 76.2% 36.3%;  /* Green */
--chart-3: 24.6 95% 53.1%;     /* Orange */
--chart-4: 262.1 83.3% 57.8%;  /* Purple */
--chart-5: 346.8 77.2% 49.8%;  /* Red */
```

## Responsive Design

- **Mobile**: Stack charts vertically
- **Tablet**: 2-column grid
- **Desktop**: 2-4 column grid
- **Height**: Fixed at 300px with ResponsiveContainer

## Accessibility

1. **ARIA Labels**: `aria-label` on charts
2. **Keyboard Navigation**: Focusable elements
3. **Screen Readers**: Descriptive text alternatives
4. **Color Contrast**: WCAG AA compliant colors

## Performance Optimizations

1. **Data Aggregation**: Pre-aggregate on backend
2. **Memoization**: Use `useMemo` for expensive calculations
3. **Pagination**: Limit data points to 50-100
4. **Caching**: 2-minute stale time for statistics
5. **Code Splitting**: Lazy load Recharts components

## Testing Strategy

1. **Unit Tests**: Test individual chart components
2. **Integration Tests**: Test data fetching and rendering
3. **Visual Regression**: Screenshot tests for charts
4. **Accessibility Tests**: Axe-core automated tests

## Error Handling

1. **No Data**: Show empty state with message
2. **Loading**: Show skeleton loaders
3. **Error**: Show error message with retry button
4. **Partial Data**: Show available charts, hide missing

## Files to Create

### Frontend
1. `client/src/hooks/useStatistics.ts` - Statistics hooks
2. `client/src/components/summary/SummaryView.tsx` - Main dashboard
3. `client/src/components/summary/StatsCards.tsx` - Statistics cards
4. `client/src/components/summary/TasksBySprintChart.tsx` - Bar chart
5. `client/src/components/summary/TasksByUserChart.tsx` - Bar chart
6. `client/src/components/summary/ProgressChart.tsx` - Pie chart
7. `client/src/components/summary/TimelineChart.tsx` - Area chart
8. `client/src/components/summary/CompletionTrendChart.tsx` - Line chart
9. `client/src/components/summary/ChartSkeleton.tsx` - Loading skeleton

### Backend
10. `server/src/tasks/statistics.ts` - Statistics service
11. Add route to `server/src/tasks/routes.ts`

### Tests
12. `tests/feature/summary-view.test.ts` - Component tests
13. `tests/CI_CD/summary-view-ci.yml` - CI/CD workflow

### Documentation
14. `docs/documentation/10-summary-view.md` - Full documentation

## Timeline

1. **Backend API** (1 hour): Create statistics endpoint
2. **Statistics Hooks** (30 min): Create data fetching hooks
3. **Stats Cards** (30 min): Create statistics cards
4. **Bar Charts** (1 hour): Implement Sprint and User charts
5. **Pie Chart** (30 min): Implement progress distribution
6. **Timeline Charts** (1 hour): Implement trend charts
7. **Main View** (30 min): Assemble dashboard
8. **Testing** (1 hour): Write comprehensive tests
9. **Documentation** (30 min): Complete documentation
10. **CI/CD** (30 min): Create workflow

**Total**: ~4-6 hours

## Success Criteria

- [ ] Summary dashboard loads in <2 seconds
- [ ] All 5 chart types render correctly
- [ ] Statistics update every 2 minutes
- [ ] Responsive on mobile, tablet, desktop
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] >80% test coverage
- [ ] CI/CD pipeline passes

## Dependencies

- Recharts 3.x installed
- Backend statistics endpoint implemented
- TanStack Query configured
- Tailwind CSS variables defined

## Risks & Mitigation

**Risk**: Large datasets slow down charts
**Mitigation**: Aggregate data on backend, limit to 100 points

**Risk**: Charts not responsive on mobile
**Mitigation**: Use ResponsiveContainer, test on multiple devices

**Risk**: Color accessibility issues
**Mitigation**: Use WCAG AA compliant color palette

## Future Enhancements

1. **Export Charts**: Download as PNG/SVG
2. **Date Range Filter**: Custom date ranges
3. **Real-time Updates**: WebSocket integration
4. **Custom Metrics**: User-defined KPIs
5. **Drill-down**: Click chart to see details
6. **Comparison**: Compare sprints/users
7. **Forecasting**: Predict completion dates

---

**Next Steps**: Begin implementation starting with backend statistics endpoint.
