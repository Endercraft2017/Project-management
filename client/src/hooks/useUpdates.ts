/**
 * TanStack Query Hooks for Daily Updates Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DailyUpdate {
  id: string;
  date: Date;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const updatesKeys = {
  all: ['updates'] as const,
  days: () => [...updatesKeys.all, 'days'] as const,
  day: (date: string) => [...updatesKeys.all, 'day', date] as const,
  userUpdate: (date: string) => [...updatesKeys.all, 'user', date] as const,
  missingMembers: (date: string) => [...updatesKeys.all, 'missing-members', date] as const,
};

/**
 * Fetch list of all days that have updates
 */
export function useUpdateDays() {
  return useQuery({
    queryKey: updatesKeys.days(),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: Date[];
      }>('/api/updates/days');
      return response.data.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Fetch all updates for a specific day
 */
export function useDayUpdates(date: string) {
  return useQuery({
    queryKey: updatesKeys.day(date),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: DailyUpdate[];
      }>(`/api/updates/${date}`);
      return response.data.data;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Fetch current user's update for a specific date
 */
export function useUserUpdateForDate(date: string) {
  return useQuery({
    queryKey: updatesKeys.userUpdate(date),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: DailyUpdate | null;
      }>(`/api/updates/user/${date}`);
      return response.data.data;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Create or update a daily update
 */
export function useCreateOrUpdateUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, content }: { date: string; content: string }) => {
      const response = await api.post<{
        success: boolean;
        data: DailyUpdate;
      }>('/api/updates', { date, content });
      return response.data.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: updatesKeys.days() });
      queryClient.invalidateQueries({ queryKey: updatesKeys.day(data.date.toString()) });
      queryClient.invalidateQueries({ queryKey: updatesKeys.userUpdate(data.date.toString()) });
    },
  });
}

/**
 * Delete a daily update
 */
export function useDeleteUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateId: string) => {
      const response = await api.delete<{
        success: boolean;
        data: { success: boolean };
      }>(`/api/updates/${updateId}`);
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate all update queries to refresh the list
      queryClient.invalidateQueries({ queryKey: updatesKeys.all });
    },
  });
}

/**
 * Fetch team members who haven't submitted updates for a specific date
 */
export function useMissingMembers(date: string) {
  return useQuery({
    queryKey: updatesKeys.missingMembers(date),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: TeamMember[];
      }>(`/api/updates/${date}/missing-members`);
      return response.data.data;
    },
    enabled: !!date,
    staleTime: 1000 * 30, // 30 seconds
  });
}
