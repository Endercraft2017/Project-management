# Feature 9: Tasks View - Frontend Implementation

**Status**: ✅ Completed
**Last Updated**: 2025-10-11

## Overview

The Tasks View is the primary interface for managing hierarchical tasks in ServiceBay PM. It provides a tree-based UI with filtering, search, inline editing, and full CRUD operations for tasks up to 4 levels deep.

## Technology Stack

### Core Technologies
- **Vite 5.x**: Build tool and dev server
- **React 18.x**: UI library with hooks
- **TypeScript 5.x**: Type-safe development
- **TailwindCSS 3.4**: Utility-first styling

### Data Fetching & State
- **TanStack Query 5.x**: Server state management
- **Axios**: HTTP client with interceptors
- **Socket.IO Client 4.x**: Real-time WebSocket

### UI Components
- **Lucide React**: Icon library
- **Radix UI**: Headless UI components
- **React Hook Form**: Form management
- **Zod**: Runtime validation

### Testing
- **Vitest 2.x**: Unit test runner
- **React Testing Library**: Component testing
- **Happy DOM**: DOM environment

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   └── tasks/
│   │       ├── TaskTree.tsx       # Main tree component
│   │       ├── TaskNode.tsx       # Recursive node component
│   │       ├── TaskForm.tsx       # Create/edit form
│   │       └── TaskFilters.tsx    # Search and filters
│   ├── hooks/
│   │   ├── useTasks.ts            # Task data hooks
│   │   ├── useUsers.ts            # User data hooks
│   │   └── useSprints.ts          # Sprint data hooks
│   ├── lib/
│   │   ├── api.ts                 # Axios client
│   │   ├── socket.ts              # Socket.IO client
│   │   └── utils.ts               # Utility functions
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── test/
│   │   ├── setup.ts               # Test setup
│   │   └── utils.tsx              # Test utilities
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── tests/
│   └── feature/
│       └── tasks-view.test.ts     # Component tests
├── vite.config.ts                 # Vite configuration
├── vitest.config.ts               # Vitest configuration
├── tailwind.config.js             # Tailwind configuration
└── tsconfig.json                  # TypeScript configuration
```

## Components

### 1. TaskTree Component

**File**: `client/src/components/tasks/TaskTree.tsx`

Main component that orchestrates the entire tasks view.

#### Features
- Hierarchical tree rendering
- Search and filtering
- Create/Edit/Delete tasks
- Real-time refetching
- Empty states
- Loading states
- Error states

#### Props
None (self-contained)

#### State Management
```typescript
const [filters, setFilters] = useState<TaskFiltersType>({});
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
const [parentTask, setParentTask] = useState<Task | null>(null);
const [showForm, setShowForm] = useState(false);
```

#### Data Fetching
```typescript
const { data: tasksData, isLoading, isError, refetch } = useTasks(filters);
const { data: currentUser } = useCurrentUser();
```

#### Tree Building Algorithm
```typescript
const taskTree = useMemo(() => {
  const buildTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    const rootTasks: Task[] = [];

    // First pass: Create map
    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    // Second pass: Build hierarchy
    tasks.forEach((task) => {
      const taskWithSubtasks = taskMap.get(task.id)!;
      if (task.parentTaskId) {
        const parent = taskMap.get(task.parentTaskId);
        if (parent) {
          parent.subtasks!.push(taskWithSubtasks);
        }
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });

    return rootTasks;
  };

  return buildTree(tasks);
}, [tasks]);
```

#### Search Filtering
```typescript
const filteredTree = useMemo(() => {
  if (!filters.search) return taskTree;

  const searchLower = filters.search.toLowerCase();
  const filterTask = (task: Task): Task | null => {
    const matchesSearch =
      task.taskName.toLowerCase().includes(searchLower) ||
      task.details?.toLowerCase().includes(searchLower);

    const filteredSubtasks = task.subtasks
      ?.map(filterTask)
      .filter((t): t is Task => t !== null);

    if (matchesSearch || filteredSubtasks?.length) {
      return { ...task, subtasks: filteredSubtasks };
    }
    return null;
  };

  return taskTree.map(filterTask).filter(Boolean);
}, [taskTree, filters.search]);
```

---

### 2. TaskNode Component

**File**: `client/src/components/tasks/TaskNode.tsx`

Recursive component that renders individual tasks with expand/collapse.

#### Props
```typescript
interface TaskNodeProps {
  task: Task;                          // Task data
  level: number;                       // Nesting level (0-3)
  onEdit: (task: Task) => void;       // Edit callback
  onCreateSubtask: (task: Task) => void; // Add subtask callback
}
```

#### Features
- **Recursive rendering**: Renders subtasks recursively
- **Auto-expand**: First 2 levels auto-expanded
- **Inline progress**: Slider to update progress
- **Action buttons**: Edit, Delete, Add Subtask (on hover)
- **Permission checks**: Role-based actions
- **Visual indicators**: Progress bar, deadline color

#### Permission Logic
```typescript
const canEdit =
  currentUser?.role === 'ADMIN' ||
  currentUser?.id === task.assignedToId ||
  currentUser?.id === task.createdById;

const canDelete = currentUser?.role === 'ADMIN';
const canCreateSubtask = level < 3; // Max nesting level
```

#### Progress Update
```typescript
const handleProgressChange = async (e) => {
  const newProgress = parseInt(e.target.value);
  await updateProgress.mutateAsync({
    taskId: task.id,
    progress: newProgress,
  });
};
```

#### Visual Styling
- Indentation based on level
- Border-left for nested tasks
- Hover effects for actions
- Color-coded progress bars
- Deadline urgency colors

---

### 3. TaskForm Component

**File**: `client/src/components/tasks/TaskForm.tsx`

Modal form for creating and editing tasks.

#### Props
```typescript
interface TaskFormProps {
  task?: Task;                    // For editing
  parentTask?: Task;              // For creating subtask
  onClose: () => void;
  onSuccess?: () => void;
}
```

#### Features
- **Create mode**: New top-level task
- **Edit mode**: Update existing task
- **Subtask mode**: Create child task
- **Validation**: Client-side with Zod
- **Sprint inheritance**: Subtasks inherit parent sprint
- **Progress slider**: Only in edit mode

#### Form Fields
```typescript
interface FormData {
  taskName: string;         // Required
  sprintId: string;         // Required (not editable after creation)
  details?: string;         // Optional
  assignedToId: string;     // Required
  startDate: string;        // Required (ISO date)
  deadline: string;         // Required (ISO date)
  progress?: number;        // Edit mode only (0-100)
}
```

#### Validation Rules
```typescript
const validate = () => {
  const errors = {};

  if (!formData.taskName?.trim()) {
    errors.taskName = 'Task name is required';
  }

  if (!formData.assignedToId) {
    errors.assignedToId = 'Assignee is required';
  }

  if (new Date(formData.startDate) > new Date(formData.deadline)) {
    errors.deadline = 'Deadline must be after start date';
  }

  return errors;
};
```

#### Submit Logic
```typescript
const handleSubmit = async (e) => {
  if (!validate()) return;

  if (isEdit) {
    await updateTask.mutateAsync({ taskId: task.id, data: formData });
  } else if (isSubtask) {
    await createSubtask.mutateAsync({
      parentTaskId: parentTask.id,
      data: formData,
    });
  } else {
    await createTask.mutateAsync(formData);
  }

  onSuccess?.();
  onClose();
};
```

---

### 4. TaskFilters Component

**File**: `client/src/components/tasks/TaskFilters.tsx`

Search and filter controls for tasks.

#### Props
```typescript
interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
}
```

#### Filter Options
- **Search**: Text search (task name, details, assignee)
- **Sprint**: Dropdown filter
- **Assigned To**: Dropdown filter
- **Nesting Level**: 0-3 levels
- **Progress Range**: Min/Max percentage

#### Features
- Expandable filter panel
- Active filter count badge
- Clear all filters button
- Real-time filtering

#### Filter State
```typescript
interface TaskFilters {
  search?: string;
  sprintId?: string;
  assignedToId?: string;
  nestingLevel?: number;      // 0-3
  progressMin?: number;        // 0-100
  progressMax?: number;        // 0-100
}
```

---

## Data Hooks

### useTasks Hook

**File**: `client/src/hooks/useTasks.ts`

TanStack Query hooks for task operations.

#### Available Hooks

##### 1. useTasks (List)
```typescript
const { data, isLoading, isError, refetch } = useTasks(filters);

// Response
interface PaginatedResponse<Task> {
  data: Task[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

##### 2. useTask (Single)
```typescript
const { data: task } = useTask(taskId, { includeSubtasks: true });
```

##### 3. useTaskHierarchy
```typescript
const { data } = useTaskHierarchy(taskId);

// Returns
{
  task: Task;
  ancestors: Task[];    // Path to root
  descendants: Task[];  // All children
}
```

##### 4. useTaskStatistics
```typescript
const { data: stats } = useTaskStatistics(taskId);

// Returns
{
  totalSubtasks: number;
  completedSubtasks: number;
  completionPercentage: number;
  averageProgress: number;
  isOnTrack: boolean;
}
```

##### 5. useCreateTask
```typescript
const createTask = useCreateTask();

await createTask.mutateAsync({
  taskName: 'New Task',
  sprintId: 'sprint-id',
  assignedToId: 'user-id',
  startDate: '2025-10-11',
  deadline: '2025-10-18',
});
```

##### 6. useUpdateTask
```typescript
const updateTask = useUpdateTask();

await updateTask.mutateAsync({
  taskId: 'task-id',
  data: { taskName: 'Updated Name', progress: 50 },
});
```

##### 7. useUpdateTaskProgress
```typescript
const updateProgress = useUpdateTaskProgress();

await updateProgress.mutateAsync({
  taskId: 'task-id',
  progress: 75,
});
```

##### 8. useDeleteTask
```typescript
const deleteTask = useDeleteTask();

await deleteTask.mutateAsync('task-id');
```

#### Query Invalidation

All mutations automatically invalidate related queries:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
}
```

---

## API Client

### Axios Client

**File**: `client/src/lib/api.ts`

#### Configuration
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000,
  withCredentials: true, // For session cookies
});
```

#### Request Interceptor
```typescript
api.interceptors.request.use((config) => {
  // Add auth tokens here if using JWT
  return config;
});
```

#### Response Interceptor
```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/google';
    }
    return Promise.reject(error);
  }
);
```

#### Type-Safe Methods
```typescript
// GET
const data = await get<Task>('/api/tasks/123');

// POST
const newTask = await post<Task>('/api/tasks', createData);

// PATCH
const updated = await patch<Task>('/api/tasks/123', updateData);

// DELETE
await del('/api/tasks/123');

// Paginated
const response = await getPaginated<Task>('/api/tasks', { page: 1 });
```

---

## Socket.IO Client

**File**: `client/src/lib/socket.ts`

Real-time WebSocket client for chat and live updates.

#### Initialization
```typescript
const socket = initializeSocket();
connectSocket();
```

#### Event Emitters
```typescript
emit('join_conversation', conversationId);
emit('send_message', { conversationId, content });
emit('typing_start', conversationId);
```

#### Event Listeners
```typescript
on('new_message', (message) => {
  console.log('New message:', message);
});

on('user_online', (userId) => {
  console.log('User online:', userId);
});
```

#### Cleanup
```typescript
useEffect(() => {
  return () => {
    off('new_message');
    disconnectSocket();
  };
}, []);
```

---

## Utility Functions

**File**: `client/src/lib/utils.ts`

### Class Name Merger
```typescript
cn('base-class', condition && 'conditional-class', 'another-class')
// Uses clsx + tailwind-merge for proper Tailwind precedence
```

### Date Formatting
```typescript
formatDate('2025-10-11T00:00:00Z')  // "Oct 11, 2025"
formatDateInput(new Date())          // "2025-10-11"
daysUntilDeadline('2025-10-18')     // 7
```

### Color Helpers
```typescript
getProgressColor(75)    // "bg-blue-500"
getDeadlineColor(date)  // "text-red-600" if overdue
```

### Text Utilities
```typescript
truncate('Long text here', 20)  // "Long text here..."
```

### Debounce
```typescript
const debouncedSearch = debounce((value) => {
  setSearch(value);
}, 300);
```

---

## Testing

### Test Setup

**File**: `client/src/test/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
```

### Test Utilities

**File**: `client/src/test/utils.tsx`

```typescript
import { render, createMockUser, createMockTask } from '@/test/utils';

const mockTask = createMockTask({ taskName: 'Test Task', progress: 50 });
const { getByText } = render(<TaskNode task={mockTask} />);
```

### Component Tests

**File**: `tests/feature/tasks-view.test.ts`

#### TaskFilters Tests
- Render search input
- Handle search input changes
- Show/hide filter panel
- Display active filter count
- Clear all filters

#### TaskForm Tests
- Render create/edit modes
- Validate required fields
- Validate date logic
- Submit form data
- Handle errors

#### TaskNode Tests
- Render task info
- Show assignee and deadline
- Update progress inline
- Call edit/delete callbacks
- Expand/collapse subtasks
- Check permission-based actions

#### TaskTree Tests
- Render header and buttons
- Show loading/error/empty states
- Build hierarchical tree
- Filter by search
- Open create/edit forms

#### Running Tests
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage

# UI mode
npm run test:ui
```

---

## Styling

### TailwindCSS Configuration

**File**: `client/tailwind.config.js`

```javascript
export default {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        destructive: 'hsl(var(--destructive))',
        // ...
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### CSS Variables

**File**: `client/src/index.css`

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

---

## Performance Optimizations

### 1. Memoization
```typescript
const taskTree = useMemo(() => buildTree(tasks), [tasks]);
const filteredTree = useMemo(() => filterTasks(taskTree), [taskTree, filters]);
```

### 2. Query Caching
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,    // 10 minutes
    },
  },
});
```

### 3. Lazy Loading
- Components loaded on demand
- Routes code-split with React.lazy
- Icons tree-shaken from lucide-react

### 4. Debounced Search
```typescript
const debouncedSearch = debounce(setFilters, 300);
```

---

## Accessibility

### Keyboard Navigation
- Tab through interactive elements
- Enter to submit forms
- Escape to close modals

### ARIA Labels
```tsx
<button aria-label="Edit Task">
  <Edit className="h-4 w-4" />
</button>
```

### Screen Reader Support
- Semantic HTML (header, main, button, etc.)
- Alt text for images
- Form labels associated with inputs

---

## Environment Variables

**File**: `client/.env.example`

```bash
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

---

## Build & Deployment

### Development
```bash
cd client
npm run dev
# Server runs on http://localhost:5173
```

### Build
```bash
npm run build
# Output: client/dist/
```

### Preview Production Build
```bash
npm run preview
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
npm run format
```

---

## API Endpoints Used

### Tasks
- `GET /api/tasks` - List tasks with filters
- `GET /api/tasks/:id` - Get single task
- `GET /api/tasks/:id/hierarchy` - Get task hierarchy
- `GET /api/tasks/:id/statistics` - Get task stats
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/progress` - Update progress
- `PATCH /api/tasks/:id/move` - Move to sprint
- `DELETE /api/tasks/:id` - Delete task

### Users
- `GET /api/users` - List users
- `GET /api/users/me` - Current user

### Sprints
- `GET /api/sprints` - List sprints
- `GET /api/sprints/active` - Get active sprint

---

## Common Issues & Solutions

### Issue: Tasks not loading
**Solution**: Check API URL in `.env`, verify backend is running

### Issue: Authentication redirect loop
**Solution**: Clear cookies, check session configuration

### Issue: Subtasks not showing
**Solution**: Ensure `includeSubtasks: true` in query params

### Issue: Progress not updating
**Solution**: Check user permissions (assignee, creator, or admin)

### Issue: Tree not building correctly
**Solution**: Verify parent-child relationships in data

---

## Future Enhancements

1. **Drag-and-drop reordering**: Using @dnd-kit
2. **Bulk operations**: Multi-select tasks
3. **Keyboard shortcuts**: Quick actions
4. **Dark mode**: Theme switcher
5. **Export/Import**: CSV/Excel support
6. **Advanced filters**: Date ranges, tags, custom fields
7. **Real-time updates**: Socket.IO integration
8. **Offline mode**: Service workers, IndexedDB
9. **Mobile responsive**: Touch-friendly UI
10. **Performance**: Virtual scrolling for large lists

---

## Related Documentation

- [Database Schema](./01-database-schema.md)
- [Task Management API](./05-task-management.md)
- [Authentication](./02-authentication.md)
- [Frontend Plan](../plans/09-frontend-setup-plan.md)

---

## Contributors

- Implementation: Claude Code
- Testing: Automated CI/CD pipeline
- Documentation: This file

---

**End of Documentation**
