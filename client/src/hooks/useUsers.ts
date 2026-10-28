/**
 * TanStack Query Hooks for User Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, get } from '@/lib/api';
import type { User } from '@/types';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: unknown) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  me: () => [...userKeys.all, 'me'] as const,
};

/**
 * Fetch all users
 */
export function useUsers(filters?: { role?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: {
          users: User[];
          pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        };
      }>('/api/users', { params: filters });
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Fetch current user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; user: User; tenant: User['tenant'] }>('/api/auth/me');
      return { ...response.data.user, tenant: response.data.tenant };
    },
    staleTime: 1000 * 60 * 15,
    retry: false, // Don't retry if not authenticated
  });
}

/**
 * Fetch user by ID
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => get<User>(`/api/users/${userId}`),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Deactivate (remove) a user
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/api/users/${userId}`);
    },
    onSuccess: () => {
      // Invalidate users list to refresh
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
