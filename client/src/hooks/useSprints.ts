/**
 * TanStack Query Hooks for Sprint Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del, getPaginated } from '@/lib/api';
import type {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
  SprintFilters,
} from '@/types';

export const sprintKeys = {
  all: ['sprints'] as const,
  lists: () => [...sprintKeys.all, 'list'] as const,
  list: (filters?: SprintFilters) => [...sprintKeys.lists(), filters] as const,
  details: () => [...sprintKeys.all, 'detail'] as const,
  detail: (id: string) => [...sprintKeys.details(), id] as const,
  active: () => [...sprintKeys.all, 'active'] as const,
};

/**
 * Fetch all sprints
 */
export function useSprints(filters?: SprintFilters) {
  return useQuery({
    queryKey: sprintKeys.list(filters),
    queryFn: () => getPaginated<Sprint>('/api/sprints', filters),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch active sprint
 */
export function useActiveSprint() {
  return useQuery({
    queryKey: sprintKeys.active(),
    queryFn: () => get<Sprint>('/api/sprints/active'),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch sprint by ID
 */
export function useSprint(sprintId: string, includeTasks = false) {
  return useQuery({
    queryKey: sprintKeys.detail(sprintId),
    queryFn: () =>
      get<Sprint>(`/api/sprints/${sprintId}`, {
        includeTasks,
      }),
    enabled: !!sprintId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create sprint (admin only)
 */
export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSprintInput) => post<Sprint>('/api/sprints', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

/**
 * Update sprint (admin only)
 */
export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sprintId,
      data,
    }: {
      sprintId: string;
      data: UpdateSprintInput;
    }) => patch<Sprint>(`/api/sprints/${sprintId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: sprintKeys.detail(variables.sprintId),
      });
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

/**
 * Delete sprint (admin only)
 */
export function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sprintId,
      moveTasksToBacklog = true,
      deleteTasks = false,
    }: {
      sprintId: string;
      moveTasksToBacklog?: boolean;
      deleteTasks?: boolean;
    }) =>
      del(`/api/sprints/${sprintId}`, {
        moveTasksToBacklog,
        deleteTasks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.all });
    },
  });
}
