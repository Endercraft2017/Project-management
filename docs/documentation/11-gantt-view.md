# Feature 11: Gantt Chart View - Timeline Visualization

**Status**: ✅ Completed
**Last Updated**: 2025-10-11

## Overview

The Gantt Chart View provides interactive timeline visualization for project tasks using Frappe Gantt library. Displays task schedules, progress, and dependencies with drag-and-drop rescheduling for admins.

## Technology Stack

- **Frappe Gantt**: Lightweight Gantt chart library (zero dependencies)
- **TanStack Query**: Data fetching
- **Date-fns**: Date manipulation
- **Lucide React**: Icons
- **Custom CSS**: Theme integration

## Components

```
client/src/components/gantt/
├── GanttView.tsx           # Main container (200 lines)
├── GanttChart.tsx          # Frappe Gantt wrapper (180 lines)
├── GanttToolbar.tsx        # Controls (80 lines)
└── TaskDetailsPanel.tsx    # Side panel (150 lines)
```

## Features

### 1. Multiple View Modes
- **Day**: Hourly breakdown
- **Week**: Daily columns (default)
- **Month**: Weekly view
- **Year**: Monthly overview

Toggle via toolbar buttons.

### 2. Sprint Filtering
Dropdown to filter tasks by sprint. Shows "All Sprints" or specific sprint tasks.

### 3. Task Visualization
- **Color-coded bars**:
  - Green: Completed (100%)
  - Blue: In Progress (1-99%)
  - Red: Overdue
  - Gray: Not Started (0%)
- **Progress indicator**: Internal bar showing completion
- **Labels**: Task names on bars

### 4. Interactive Features

**For All Users**:
- Click task to view details in side panel
- Change view mode
- Filter by sprint
- Export chart as PNG

**For Admins Only**:
- Drag-and-drop to reschedule
- Resize bars to change duration
- Update progress inline

### 5. Task Details Panel
Side panel shows:
- Task name
- Sprint assignment
- Assigned user with avatar
- Timeline (start & deadline)
- Days remaining/overdue
- Progress bar
- Description
- Nesting level
- Subtask count
- Creator info

### 6. Export Functionality
Export Gantt chart as PNG image with filename: `gantt-chart-YYYY-MM-DD.png`

## Component Details

### GanttView.tsx

Main container component.

**State**:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('Week');
const [selectedSprint, setSelectedSprint] = useState<string>('');
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
```

**Data Fetching**:
```typescript
const { data: tasksData } = useTasks({
  sprintId: selectedSprint || undefined,
  nestingLevel: 0, // Top-level only
});
```

**Permissions**:
- Read-only for non-admin users
- Shows banner: "Viewing in read-only mode"
- Drag-drop disabled for members

### GanttChart.tsx

Wrapper for Frappe Gantt library.

**Props**:
```typescript
{
  tasks: Task[];
  viewMode: ViewMode;
  onTaskChange?: (task, action) => void;
  onTaskClick?: (task) => void;
  readOnly?: boolean;
}
```

**Task Transformation**:
```typescript
const ganttTasks = tasks.map(task => ({
  id: task.id,
  name: task.taskName,
  start: task.startDate,
  end: task.deadline,
  progress: task.progress,
  custom_class: getTaskClass(task),
}));
```

**Gantt Configuration**:
```typescript
new Gantt(container, ganttTasks, {
  view_mode: viewMode,
  on_click: (task) => onTaskClick?.(task),
  on_date_change: (task, start, end) => onTaskChange?.(task, 'date'),
  on_progress_change: (task, progress) => onTaskChange?.(task, 'progress'),
  bar_height: 30,
  bar_corner_radius: 3,
  arrow_curve: 5,
  padding: 18,
  readonly: readOnly,
});
```

**Empty State**:
Shows message: "No tasks to display. Create tasks with start and end dates to see them here."

### GanttToolbar.tsx

Controls for view mode, filters, and export.

**View Mode Switcher**:
4 buttons (Day/Week/Month/Year) with active state highlighting.

**Sprint Filter**:
Dropdown populated from `useSprints()` hook.

**Export Button**:
Converts SVG to canvas, downloads as PNG.

### TaskDetailsPanel.tsx

Side panel with comprehensive task information.

**Sections**:
1. **Header**: Task name + close button
2. **Sprint**: Name with icon
3. **Assigned To**: User with avatar
4. **Timeline**: Start date, deadline, days remaining
5. **Progress**: Percentage + visual bar
6. **Description**: Task details (if provided)
7. **Metadata**: Nesting level, subtask count, creator

**Overdue Indicator**:
Shows "Xd overdue" in red for past deadlines.

## Styling

### Custom CSS (`gantt.css`)

**Theme Integration**:
```css
.gantt .grid-background {
  fill: hsl(var(--background));
}

.gantt-task-completed .bar {
  fill: hsl(142.1 76.2% 36.3%); /* Green */
}

.gantt-task-overdue .bar {
  fill: hsl(0 84.2% 60.2%); /* Red */
}
```

**Dark Mode Support**:
Automatically adapts using CSS custom properties.

**Responsive**:
- Horizontal scroll on mobile
- Reduced font sizes on small screens
- Fixed height (400px minimum)

## Usage

### Basic Implementation

```typescript
import GanttView from '@/components/gantt/GanttView';

function App() {
  return (
    <div className="container p-6">
      <GanttView />
    </div>
  );
}
```

### Programmatic View Change

```typescript
const [viewMode, setViewMode] = useState<ViewMode>('Week');

// Switch to month view
setViewMode('Month');
```

### Export Chart

```typescript
const handleExport = () => {
  // Implemented in GanttView component
  // Automatically downloads PNG
};
```

## API Endpoints Used

- `GET /api/tasks` - Fetch tasks with filters
- `PATCH /api/tasks/:id` - Update task dates/progress (admin only)
- `GET /api/sprints` - Fetch sprints for filter dropdown

## Performance

### Optimizations
1. **Limited Data**: Only top-level tasks (no subtasks)
2. **Memoization**: Task transformation cached
3. **Lazy Rendering**: Frappe Gantt only renders visible dates
4. **Query Caching**: TanStack Query caches for 5 minutes

### Load Time Targets
- **Component Mount**: < 200ms
- **View Mode Switch**: < 100ms
- **Task Update**: < 500ms

## Testing

### Test Coverage
**File**: `tests/feature/gantt-view.test.ts`

**Tests** (25+):
- GanttToolbar: View mode buttons, sprint filter, export
- TaskDetailsPanel: Task info display, progress bar, close button
- GanttView: Loading/error states, permissions, refetch

### CI/CD Pipeline
**File**: `tests/CI_CD/gantt-view-ci.yml`

**Jobs** (4):
1. Component tests
2. Integration tests
3. Type check
4. Lint

## Permissions

| Action | Member | Admin |
|--------|--------|-------|
| View Gantt | ✅ | ✅ |
| Change view mode | ✅ | ✅ |
| Filter by sprint | ✅ | ✅ |
| Click task details | ✅ | ✅ |
| Drag-drop reschedule | ❌ | ✅ |
| Update progress | ❌ | ✅ |
| Export chart | ✅ | ✅ |

## Error Handling

### No Tasks
Shows empty state with helpful message.

### Invalid Dates
Skips tasks with missing start/end dates.

### Gantt Init Failure
Logs error to console, shows empty state.

### Update Failure
Displays alert, reverts changes automatically.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note**: Mobile view supported but optimized for desktop (1024px+).

## Accessibility

- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ ARIA labels on interactive elements
- ✅ Focus indicators
- ✅ Color contrast (WCAG AA)

## Future Enhancements

1. **Dependencies**: Task arrows showing relationships
2. **Critical Path**: Highlight longest task chain
3. **Baselines**: Show planned vs actual timeline
4. **Milestones**: Special markers for key dates
5. **Resource View**: Group by assigned user
6. **Real-time Updates**: WebSocket sync
7. **Bulk Edit**: Multi-select and reschedule
8. **Templates**: Save/load configurations
9. **Mobile Optimization**: Touch-friendly gestures
10. **Print View**: Printer-optimized layout

## Troubleshooting

### Issue: Gantt not rendering
**Solution**: Check if frappe-gantt is installed: `npm install frappe-gantt`

### Issue: Tasks not showing
**Solution**: Verify tasks have valid startDate and deadline

### Issue: Drag-drop not working
**Solution**: Check user role (admin only) and readOnly prop

### Issue: Export not downloading
**Solution**: Check browser permissions for downloads

### Issue: Styles not applied
**Solution**: Import gantt.css in component: `import '@/styles/gantt.css'`

## Related Documentation

- [Task Management API](./05-task-management.md)
- [Tasks View](./09-tasks-view.md)
- [Summary View](./10-summary-view.md)
- [Gantt View Plan](../plans/11-gantt-view-plan.md)

## Contributors

- Implementation: Claude Code
- Library: Frappe Gantt
- Testing: Automated CI/CD

---

**End of Documentation**
