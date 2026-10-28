/**
 * TanStack Query Hooks for Task Management
 * Provides data fetching, caching, and mutation hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { get, post, patch, del, getPaginated } from '@/lib/api';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  PaginatedResponse,
} from '@/types';

// Query keys
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  hierarchy: (id: string) => [...taskKeys.all, 'hierarchy', id] as const,
  statistics: (id: string) => [...taskKeys.all, 'statistics', id] as const,
};

/**
 * Fetch all tasks with optional filters
 */
export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () =>
      getPaginated<Task>('/api/tasks', {
        ...filters,
        includeSubtasks: true,
        limit: 1000, // Fetch all tasks (backend max is 100 per page, but we need all)
      }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch a single task by ID
 */
export function useTask(
  taskId: string,
  viewMode?: 'normal' | 'mention',
  options?: { includeSubtasks?: boolean }
) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () =>
      get<Task>(`/api/tasks/${taskId}`, {
        includeSubtasks: options?.includeSubtasks ?? true,
        ...(viewMode === 'mention' && { viewMode }),
      }),
    enabled: !!taskId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch task hierarchy (ancestors and descendants)
 */
export function useTaskHierarchy(taskId: string) {
  return useQuery({
    queryKey: taskKeys.hierarchy(taskId),
    queryFn: () =>
      get<{
        task: Task;
        ancestors: Task[];
        descendants: Task[];
      }>(`/api/tasks/${taskId}/hierarchy`),
    enabled: !!taskId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch task statistics
 */
export function useTaskStatistics(taskId: string) {
  return useQuery({
    queryKey: taskKeys.statistics(taskId),
    queryFn: () =>
      get<{
        taskId: string;
        totalSubtasks: number;
        completedSubtasks: number;
        completionPercentage: number;
        totalEstimatedHours: number;
        averageProgress: number;
        isOnTrack: boolean;
      }>(`/api/tasks/${taskId}/statistics`),
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => post<Task>('/api/tasks', data),
    onSuccess: () => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Update an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: UpdateTaskInput;
    }) => patch<Task>(`/api/tasks/${taskId}`, data),
    onSuccess: (_, variables) => {
      // Invalidate specific task and lists
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.taskId),
      });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (error, variables) => {
      // If task not found (404), remove it from cache and invalidate
      if (isAxiosError(error) && error.response?.status === 404) {
        console.log('Task not found (404) - removing from cache and refreshing');

        // Remove this specific task from all cached queries
        queryClient.setQueriesData<PaginatedResponse<Task>>(
          { queryKey: taskKeys.lists() },
          (oldData) => {
            if (!oldData?.data) return oldData;
            return {
              ...oldData,
              data: oldData.data.filter((task) => task.id !== variables.taskId)
            };
          }
        );

        // Force refetch
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      }
    },
  });
}

/**
 * Move task to different sprint (admin only)
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      sprintId,
    }: {
      taskId: string;
      sprintId: string;
    }) => patch<Task>(`/api/tasks/${taskId}/move`, { sprintId }),
    onSuccess: () => {
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Delete a task (admin only)
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => del(`/api/tasks/${taskId}`),
    onSuccess: () => {
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Create a subtask
 */
export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      parentTaskId,
      data,
    }: {
      parentTaskId: string;
      data: CreateTaskInput;
    }) =>
      post<Task>('/api/tasks', {
        ...data,
        parentTaskId,
      }),
    onSuccess: (_, variables) => {
      // Invalidate parent task and lists
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.parentTaskId),
      });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Delete all tasks in the system
 */
export function useDeleteAllTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => del<{ deletedCount: number }>('/api/tasks/bulk/all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Delete all tasks in a sprint
 */
export function useDeleteSprintTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) =>
      del<{ deletedCount: number }>(`/api/tasks/bulk/sprint/${sprintId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Delete all subtasks under a task
 */
export function useDeleteTaskSubtasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      del<{ deletedCount: number }>(`/api/tasks/${taskId}/subtasks`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
