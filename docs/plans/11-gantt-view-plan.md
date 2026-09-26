# Feature 11: Gantt Chart View - Implementation Plan

**Feature**: Gantt Chart Timeline Visualization
**Estimated Effort**: 4-5 hours
**Dependencies**: Feature 9 (Frontend Setup), Feature 5 (Task Management API)
**Priority**: High

## Research Summary

### Frappe Gantt (2025)
- **Type**: Open-source JavaScript Gantt library
- **Key Features**:
  - Zero dependencies
  - Aesthetically pleasing and minimalist
  - Customizable views (Hour, Day, Week, Month, Year)
  - Exclude weekends/holidays
  - Interactive drag-and-drop
  - Task dependencies with arrows
  - Progress bars
  - Custom styling
- **React Integration**: frappe-gantt-react wrapper available
- **Best For**: Small to medium projects, clean interface, simple implementation
- **Performance**: Lightweight, fast rendering

### Features Available
1. **Multiple View Modes**: Hour, Day, Week, Month, Year
2. **Task Properties**:
   - ID, name, start date, end date, progress
   - Dependencies (predecessor tasks)
   - Custom classes for styling
3. **Interactions**:
   - Drag to reschedule
   - Resize to change duration
   - Click events
   - Progress update
4. **Customization**:
   - Bar colors, heights
   - Header formats
   - Arrow styles
   - Language support

### Best Practices (2025)
1. **Data Format**: Tasks array with start/end dates as Date objects or ISO strings
2. **View Mode**: Default to "Week" for best balance
3. **Holidays**: Configure weekend exclusion for accurate timelines
4. **Dependencies**: Use task IDs to link predecessor/successor
5. **Performance**: Limit to 100-200 tasks for smooth rendering
6. **Responsive**: Use container width, fixed height (400-600px)
7. **Error Handling**: Validate date ranges, handle missing data

## Feature Overview

The Gantt Chart View provides interactive timeline visualization for tasks:
- Display all tasks with start/end dates
- Show task dependencies with arrows
- Visual progress bars (0-100%)
- Multiple view modes (Day, Week, Month)
- Sprint-based filtering
- Drag-and-drop rescheduling (admin only)
- Export/Print capability

## Technology Stack

### Libraries
- **frappe-gantt**: Gantt chart library
- **frappe-gantt-react**: React wrapper (optional)
- **date-fns**: Date manipulation
- **TanStack Query**: Data fetching
- **Lucide React**: Icons

### Components Structure
```
client/src/components/gantt/
├── GanttView.tsx           # Main Gantt container
├── GanttChart.tsx          # Frappe Gantt wrapper
├── GanttToolbar.tsx        # View mode, filters, export
└── TaskDetailsPanel.tsx    # Side panel for task details
```

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd client
npm install frappe-gantt date-fns
```

### Step 2: Create Gantt Chart Wrapper

Create `client/src/components/gantt/GanttChart.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import type { Task } from '@/types';

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
}

interface GanttChartProps {
  tasks: Task[];
  viewMode: 'Day' | 'Week' | 'Month' | 'Year';
  onTaskChange?: (task: GanttTask) => void;
  onTaskClick?: (task: GanttTask) => void;
}

export default function GanttChart({
  tasks,
  viewMode,
  onTaskChange,
  onTaskClick,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<Gantt | null>(null);

  // Transform tasks to Gantt format
  const ganttTasks: GanttTask[] = tasks.map((task) => ({
    id: task.id,
    name: task.taskName,
    start: task.startDate,
    end: task.deadline,
    progress: task.progress,
    custom_class: getTaskClass(task),
  }));

  useEffect(() => {
    if (!containerRef.current || ganttTasks.length === 0) return;

    ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
      view_mode: viewMode,
      on_click: (task) => onTaskClick?.(task),
      on_date_change: (task, start, end) => {
        onTaskChange?.({ ...task, start, end });
      },
      on_progress_change: (task, progress) => {
        onTaskChange?.({ ...task, progress });
      },
      bar_height: 30,
      bar_corner_radius: 3,
      arrow_curve: 5,
      padding: 18,
      popup_trigger: 'click',
    });

    return () => {
      ganttRef.current = null;
    };
  }, [ganttTasks, viewMode]);

  return <div ref={containerRef} className="gantt-container" />;
}

function getTaskClass(task: Task): string {
  if (task.progress === 100) return 'gantt-task-completed';
  if (new Date(task.deadline) < new Date()) return 'gantt-task-overdue';
  if (task.progress > 0) return 'gantt-task-in-progress';
  return 'gantt-task-not-started';
}
```

### Step 3: Create Toolbar Component

```typescript
interface GanttToolbarProps {
  viewMode: string;
  onViewModeChange: (mode: string) => void;
  onExport: () => void;
  selectedSprint?: string;
  onSprintChange: (sprintId: string) => void;
}

export default function GanttToolbar({
  viewMode,
  onViewModeChange,
  onExport,
  selectedSprint,
  onSprintChange,
}: GanttToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-2">
        {['Day', 'Week', 'Month', 'Year'].map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={`px-3 py-1 rounded ${
              viewMode === mode ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <SprintFilter value={selectedSprint} onChange={onSprintChange} />

      <button onClick={onExport}>Export</button>
    </div>
  );
}
```

### Step 4: Create Main Gantt View

```typescript
export default function GanttView() {
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Week');
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasksData } = useTasks({
    sprintId: selectedSprint,
    includeSubtasks: false, // Only top-level for Gantt
  });

  const tasks = tasksData?.data || [];

  const handleTaskChange = (task: GanttTask) => {
    // Update task dates (admin only)
    updateTask.mutate({
      taskId: task.id,
      data: {
        startDate: task.start,
        deadline: task.end,
        progress: task.progress,
      },
    });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <GanttToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedSprint={selectedSprint}
          onSprintChange={setSelectedSprint}
        />
        <GanttChart
          tasks={tasks}
          viewMode={viewMode}
          onTaskChange={handleTaskChange}
          onTaskClick={setSelectedTask}
        />
      </div>

      {selectedTask && (
        <TaskDetailsPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
```

### Step 5: Add Custom Styles

Create `client/src/styles/gantt.css`:

```css
.gantt-container {
  overflow-x: auto;
  background: hsl(var(--background));
}

.gantt-task-completed .bar {
  fill: hsl(142.1 76.2% 36.3%); /* Green */
}

.gantt-task-overdue .bar {
  fill: hsl(0 84.2% 60.2%); /* Red */
}

.gantt-task-in-progress .bar {
  fill: hsl(var(--primary)); /* Blue */
}

.gantt-task-not-started .bar {
  fill: hsl(var(--muted)); /* Gray */
}

.gantt .bar-progress {
  fill: hsl(var(--primary));
}

.gantt .bar-label {
  fill: hsl(var(--primary-foreground));
  font-size: 12px;
}
```

## Data Requirements

### Task Properties for Gantt
- `id`: Unique identifier
- `taskName`: Display name
- `startDate`: ISO 8601 date string
- `deadline`: ISO 8601 date string
- `progress`: Number (0-100)
- `dependencies`: Optional task IDs (comma-separated)

### Filtering
- Only top-level tasks (no subtasks for clarity)
- Filter by sprint
- Filter by date range

## Features to Implement

1. **View Modes**: Day, Week, Month, Year toggle
2. **Sprint Filter**: Dropdown to filter tasks by sprint
3. **Task Details Panel**: Click task to see full details
4. **Drag to Reschedule**: Admin-only, updates start/end dates
5. **Progress Update**: Click bar to edit progress
6. **Export**: Export as PNG or print
7. **Zoom Controls**: +/- buttons for view adjustment
8. **Today Marker**: Vertical line showing current date
9. **Holidays**: Exclude weekends from timeline
10. **Dependencies**: Show arrows between related tasks

## Permissions

- **All Users**: View Gantt chart, change view mode, filter
- **Assigned User/Creator**: Click for details
- **Admin Only**: Drag-and-drop reschedule, edit progress

## Performance Optimizations

1. **Limit Tasks**: Show max 100 tasks, paginate if needed
2. **Memoization**: Use `useMemo` for task transformation
3. **Debounce Updates**: Debounce drag events by 500ms
4. **Lazy Rendering**: Only render visible date range
5. **Caching**: Use TanStack Query cache (5 min stale time)

## Testing Strategy

1. **Unit Tests**: Test task transformation logic
2. **Component Tests**: Test toolbar, filters, interactions
3. **Integration Tests**: Test Gantt library integration
4. **Visual Tests**: Screenshot comparison for rendering
5. **Interaction Tests**: Test drag-drop, click events

## Error Handling

1. **No Tasks**: Show empty state with "No tasks to display"
2. **Invalid Dates**: Skip tasks with missing/invalid dates
3. **Rendering Error**: Fallback to table view
4. **Update Failure**: Show error toast, revert changes

## Files to Create

### Frontend
1. `client/src/components/gantt/GanttView.tsx` - Main view
2. `client/src/components/gantt/GanttChart.tsx` - Frappe Gantt wrapper
3. `client/src/components/gantt/GanttToolbar.tsx` - Controls
4. `client/src/components/gantt/TaskDetailsPanel.tsx` - Side panel
5. `client/src/styles/gantt.css` - Custom Gantt styles

### Tests
6. `tests/feature/gantt-view.test.ts` - Component tests
7. `tests/CI_CD/gantt-view-ci.yml` - CI/CD workflow

### Documentation
8. `docs/documentation/11-gantt-view.md` - Full documentation

## Timeline

1. **Install Dependencies** (10 min)
2. **Gantt Chart Wrapper** (1 hour)
3. **Toolbar Component** (30 min)
4. **Main Gantt View** (1 hour)
5. **Task Details Panel** (30 min)
6. **Custom Styling** (30 min)
7. **Testing** (1 hour)
8. **Documentation** (30 min)
9. **CI/CD** (30 min)

**Total**: ~4-5 hours

## Success Criteria

- [ ] Gantt chart renders with all tasks
- [ ] View modes switch correctly (Day/Week/Month/Year)
- [ ] Sprint filter works
- [ ] Task details panel shows on click
- [ ] Drag-and-drop updates dates (admin only)
- [ ] Progress bars display correctly
- [ ] Export to PNG works
- [ ] Responsive on desktop (not mobile-optimized)
- [ ] >80% test coverage
- [ ] CI/CD pipeline passes

## Dependencies

- frappe-gantt installed
- Tasks API complete
- Admin permissions working
- Date-fns installed

## Risks & Mitigation

**Risk**: Frappe Gantt doesn't work with React 18
**Mitigation**: Use direct DOM manipulation, test thoroughly

**Risk**: Too many tasks slow down rendering
**Mitigation**: Limit to 100 tasks, add pagination

**Risk**: Drag-drop conflicts with permissions
**Mitigation**: Disable drag for non-admin users

## Future Enhancements

1. **Dependencies**: Implement task dependencies with arrows
2. **Critical Path**: Highlight critical path in red
3. **Baselines**: Show planned vs actual timeline
4. **Resource View**: Group tasks by assigned user
5. **Milestones**: Special markers for key dates
6. **Custom Fields**: Show additional task metadata
7. **Bulk Edit**: Select multiple tasks to reschedule
8. **Templates**: Save/load Gantt configurations
9. **Collaboration**: Real-time updates via WebSocket
10. **Mobile View**: Responsive Gantt for tablets

---

**Next Steps**: Begin implementation starting with dependencies installation and Gantt wrapper component.
