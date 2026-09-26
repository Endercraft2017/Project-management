/**
 * Test Utilities
 * Provides helpers for testing React components
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User, Task, Sprint } from '@/types';

// Create a custom render function with providers
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Mock Data Factories
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'test@servicebay.ai',
    name: 'Test User',
    role: 'MEMBER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockSprint(overrides?: Partial<Sprint>): Sprint {
  return {
    id: 'sprint-1',
    name: 'Sprint 1',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ACTIVE',
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    taskName: 'Test Task',
    sprintId: 'sprint-1',
    details: 'Test task details',
    progress: 0,
    assignedToId: 'user-1',
    startDate: new Date().toISOString(),
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    nestingLevel: 0,
    createdById: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export * from '@testing-library/react';
export { customRender as render };
