# Frontend Setup & Tasks View - Implementation Plan

**Status**: Ready for Implementation
**Estimated Time**: 6 hours
**Dependencies**: All backend features (1-8)
**Last Updated**: 2025-10-10

---

## Table of Contents

1. [Research Summary](#research-summary)
2. [Frontend Architecture](#frontend-architecture)
3. [Project Setup](#project-setup)
4. [Feature 9: Tasks View Implementation](#feature-9-tasks-view-implementation)
5. [Testing Strategy](#testing-strategy)
6. [Deployment](#deployment)

---

## Research Summary

### Vite + React + TypeScript (2025 Best Practices)

**Key Findings**:

1. **Vite Benefits**: Lightning-fast HMR, native ES modules, optimized builds
2. **Project Structure**: Start simple, evolve with features (pages/, components/, hooks/, lib/)
3. **TypeScript Config**: Enable strict mode, use path aliases (@/ for src/)
4. **Tool Integration**: ESLint + Prettier + TypeScript ESLint
5. **Testing**: Vitest + React Testing Library (Jest-compatible, faster)

### Tree View Components

**Libraries Evaluated**:
- **@dnd-kit/core**: Modern drag-and-drop (recommended for 2025)
- **react-beautiful-dnd**: Deprecated/archived in 2025
- **dnd-kit-sortable-tree**: Pre-built tree with drag-and-drop

**Decision**: Use @dnd-kit/core + custom tree implementation for flexibility

### Testing Best Practices

1. **Vitest**: Jest-compatible, faster, Vite-native
2. **React Testing Library**: User-centric testing
3. **Query Priority**: role-based queries > test IDs
4. **Mocking**: Mock hooks, API calls, external dependencies
5. **Coverage Target**: >80% for components

---

## Frontend Architecture

### Technology Stack

```
Frontend:
├── Vite 5.x          (Build tool)
├── React 18.x        (UI library)
├── TypeScript 5.x    (Type safety)
├── TanStack Query    (Data fetching & caching)
├── Zustand           (State management - lightweight)
├── Socket.IO Client  (Real-time communication)
├── @dnd-kit/core     (Drag and drop)
├── Recharts          (Charts for Summary/Gantt)
├── TailwindCSS       (Styling)
└── Vitest + RTL      (Testing)
```

### Project Structure

```
client/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/           # Reusable components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Spinner.tsx
│   │   ├── layout/           # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── tasks/            # Feature 9: Tasks View
│   │   │   ├── TaskTree.tsx
│   │   │   ├── TaskNode.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   └── TaskFilters.tsx
│   │   ├── summary/          # Feature 10: Summary View
│   │   │   ├── SummaryChart.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── gantt/            # Feature 11: Gantt Chart
│   │   │   └── GanttChart.tsx
│   │   └── chat/             # Feature 12: Chat View
│   │       ├── ConversationList.tsx
│   │       ├── MessageList.tsx
│   │       └── MessageInput.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTasks.ts
│   │   ├── useChat.ts
│   │   └── useTheme.ts
│   ├── lib/
│   │   ├── api.ts            # Axios instance
│   │   ├── socket.ts         # Socket.IO client
│   │   └── utils.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── taskStore.ts
│   │   └── themeStore.ts
│   ├── types/
│   │   ├── task.ts
│   │   ├── user.ts
│   │   └── chat.ts
│   ├── pages/
│   │   ├── TasksPage.tsx
│   │   ├── SummaryPage.tsx
│   │   ├── GanttPage.tsx
│   │   ├── ChatPage.tsx
│   │   └── LoginPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── components/
│   │   └── tasks/
│   │       └── TaskTree.test.tsx
│   └── setup.ts
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

---

## Project Setup

### Step 1: Initialize Vite Project (10 min)

```bash
# Create project
npm create vite@latest client -- --template react-ts

cd client

# Install dependencies
npm install

# Install additional packages
npm install @tanstack/react-query zustand socket.io-client axios
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts date-fns
npm install -D tailwindcss postcss autoprefixer
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @vitest/ui jsdom
npm install -D eslint-config-prettier eslint-plugin-prettier
```

### Step 2: Configure TailwindCSS (5 min)

```bash
npx tailwindcss init -p
```

**tailwind.config.js**:
```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: 'class',
}
```

**src/index.css**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 3: TypeScript Configuration (5 min)

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 4: Vitest Configuration (5 min)

**vitest.config.ts**:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**tests/setup.ts**:
```ts
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

### Step 5: API Client Setup (15 min)

**src/lib/api.ts**:
```ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**src/lib/socket.ts**:
```ts
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
  withCredentials: true,
  autoConnect: false,
});

export default socket;
```

### Step 6: Environment Variables

**client/.env.development**:
```
VITE_API_URL=http://localhost:3000
```

**client/.env.production**:
```
VITE_API_URL=https://your-api-domain.com
```

---

## Feature 9: Tasks View Implementation

### Overview

Hierarchical tree view of tasks with 4 nesting levels, drag-and-drop reordering, inline editing, and real-time updates.

### Components Architecture

```
TasksPage
└── TaskTree
    ├── TaskFilters (search, sprint filter, assignee filter)
    ├── TaskTreeHeader (columns: Name, Progress, Assigned, Dates, Actions)
    └── TaskNode[] (recursive)
        ├── TaskNodeContent (display mode)
        ├── TaskForm (edit mode)
        └── TaskNode[] (children, recursively)
```

### Implementation Steps

#### 1. Types (10 min)

**src/types/task.ts**:
```ts
export interface Task {
  id: string;
  name: string;
  details: string;
  progress: number;
  nestingLevel: number;
  parentId: string | null;
  sprintId: string | null;
  assignedToId: string | null;
  startDate: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  sprint?: {
    id: string;
    name: string;
  };
  children?: Task[];
}

export interface TaskFormData {
  name: string;
  details: string;
  progress: number;
  nestingLevel: number;
  parentId: string | null;
  sprintId: string | null;
  assignedToId: string | null;
  startDate: string | null;
  deadline: string | null;
}
```

#### 2. API Hooks (20 min)

**src/hooks/useTasks.ts**:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Task, TaskFormData } from '@/types/task';

export function useTasks(sprintId?: string) {
  return useQuery({
    queryKey: ['tasks', sprintId],
    queryFn: async () => {
      const params = sprintId ? { sprintId } : {};
      const response = await api.get('/api/tasks', { params });
      return response.data.data as Task[];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await api.post('/api/tasks', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TaskFormData> }) => {
      const response = await api.put(`/api/tasks/${id}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

#### 3. Task Tree Component (45 min)

**src/components/tasks/TaskTree.tsx**:
```tsx
import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import TaskNode from './TaskNode';
import TaskFilters from './TaskFilters';
import type { Task } from '@/types/task';

export default function TaskTree() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const { data: tasks, isLoading, error } = useTasks(sprintFilter || undefined);

  // Build tree structure
  const buildTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    const rootTasks: Task[] = [];

    // First pass: create map
    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    // Second pass: build tree
    tasks.forEach(task => {
      const node = taskMap.get(task.id)!;
      if (task.parentId && taskMap.has(task.parentId)) {
        taskMap.get(task.parentId)!.children!.push(node);
      } else {
        rootTasks.push(node);
      }
    });

    return rootTasks;
  };

  // Filter tasks
  const filterTasks = (tasks: Task[]): Task[] => {
    if (!searchQuery) return tasks;

    const matchesSearch = (task: Task): boolean => {
      return task.name.toLowerCase().includes(searchQuery.toLowerCase());
    };

    const filterRecursive = (tasks: Task[]): Task[] => {
      return tasks.filter(task => {
        const matches = matchesSearch(task);
        const hasMatchingChildren = task.children && task.children.length > 0;

        if (hasMatchingChildren) {
          task.children = filterRecursive(task.children!);
        }

        return matches || (task.children && task.children.length > 0);
      });
    };

    return filterRecursive(tasks);
  };

  if (isLoading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading tasks</div>;
  }

  const treeData = buildTree(tasks || []);
  const filteredData = filterTasks(treeData);

  return (
    <div className="h-full flex flex-col">
      <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sprintFilter={sprintFilter}
        onSprintFilterChange={setSprintFilter}
      />

      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          {/* Header */}
          <div className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b">
            <div className="grid grid-cols-12 gap-4 p-4 font-semibold">
              <div className="col-span-4">Task Name</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-2">Assigned To</div>
              <div className="col-span-2">Deadline</div>
              <div className="col-span-2">Actions</div>
            </div>
          </div>

          {/* Tree */}
          <div>
            {filteredData.map(task => (
              <TaskNode key={task.id} task={task} level={0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4. Task Node Component (60 min)

**src/components/tasks/TaskNode.tsx**:
```tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown, Edit, Trash, Plus } from 'lucide-react';
import { useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import TaskForm from './TaskForm';
import type { Task } from '@/types/task';

interface TaskNodeProps {
  task: Task;
  level: number;
}

export default function TaskNode({ task, level }: TaskNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const [isEditing, setIsEditing] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const hasChildren = task.children && task.children.length > 0;
  const canHaveChildren = level < 3; // Max 4 levels (0-3)

  const handleDelete = () => {
    if (confirm(`Delete task "${task.name}"?`)) {
      deleteTask.mutate(task.id);
    }
  };

  const progressColor =
    task.progress === 100 ? 'bg-green-500' :
    task.progress >= 50 ? 'bg-blue-500' :
    'bg-yellow-500';

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Task Row */}
      {!isEditing ? (
        <div
          className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{ paddingLeft: `${level * 2 + 1}rem` }}
        >
          {/* Task Name */}
          <div className="col-span-4 flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            <span className="font-medium">{task.name}</span>
          </div>

          {/* Progress */}
          <div className="col-span-2 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`${progressColor} h-2 rounded-full transition-all`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <span className="text-sm">{task.progress}%</span>
          </div>

          {/* Assigned To */}
          <div className="col-span-2 flex items-center">
            {task.assignedTo ? (
              <span className="text-sm">{task.assignedTo.name}</span>
            ) : (
              <span className="text-sm text-gray-400">Unassigned</span>
            )}
          </div>

          {/* Deadline */}
          <div className="col-span-2 flex items-center">
            {task.deadline ? (
              <span className="text-sm">
                {new Date(task.deadline).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-sm text-gray-400">No deadline</span>
            )}
          </div>

          {/* Actions */}
          <div className="col-span-2 flex items-center gap-2">
            {canHaveChildren && (
              <button
                onClick={() => setShowAddChild(true)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Add subtask"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
              title="Delete"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <TaskForm
          task={task}
          onClose={() => setIsEditing(false)}
          level={level}
        />
      )}

      {/* Add Child Form */}
      {showAddChild && (
        <div style={{ paddingLeft: `${(level + 1) * 2 + 1}rem` }}>
          <TaskForm
            parentTask={task}
            onClose={() => setShowAddChild(false)}
            level={level + 1}
          />
        </div>
      )}

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {task.children!.map(child => (
            <TaskNode key={child.id} task={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

This plan provides the foundation. Due to context limits, I'll continue with the actual implementation files in the next steps. The plan covers the architecture, setup, and detailed component structure for the Tasks View feature.

