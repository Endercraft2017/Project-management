/**
 * Custom hooks for Missing Updates API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, put } from '@/lib/api';
import type {
  MissingUpdatesConfig,
  MissingUpdatesResult,
  SendUpdateReminderRequest,
  SendUpdateReminderResponse,
  AdminSetting,
} from '@/types';

// Query Keys
export const MISSING_UPDATES_KEYS = {
  all: ['missing-updates'] as const,
  config: () => [...MISSING_UPDATES_KEYS.all, 'config'] as const,
  users: (startDate?: string, endDate?: string) =>
    [...MISSING_UPDATES_KEYS.all, 'users', startDate, endDate] as const,
};

/**
 * Get missing updates configuration (Admin only)
 */
export function useMissingUpdatesConfig() {
  return useQuery({
    queryKey: MISSING_UPDATES_KEYS.config(),
    queryFn: () =>
      get<MissingUpdatesConfig>('/api/admin/settings/missing-updates/config'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update missing updates configuration (Admin only)
 */
export function useUpdateMissingUpdatesConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: MissingUpdatesConfig) =>
      put<AdminSetting>('/api/admin/settings/missing-updates/config', config),
    onSuccess: () => {
      // Invalidate config query
      queryClient.invalidateQueries({ queryKey: MISSING_UPDATES_KEYS.config() });
    },
  });
}

/**
 * Get users with missing updates (Admin only)
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @param enabled - Whether to enable the query
 */
export function useMissingUpdates(
  startDate?: string,
  endDate?: string,
  enabled = true
) {
  return useQuery({
    queryKey: MISSING_UPDATES_KEYS.users(startDate, endDate),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const url = `/api/admin/updates/missing${params.toString() ? `?${params.toString()}` : ''}`;
      return get<MissingUpdatesResult>(url);
    },
    enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Send update reminder notification to a user (Admin only)
 */
export function useSendUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SendUpdateReminderRequest) => {
      console.log('[useSendUpdateReminder] Sending POST request to /api/admin/updates/send-reminder');
      console.log('[useSendUpdateReminder] Request payload:', request);
      return post<SendUpdateReminderResponse>('/api/admin/updates/send-reminder', request);
    },
    onSuccess: (data) => {
      console.log('[useSendUpdateReminder] Request successful:', data);
      // Optionally refresh missing updates data
      queryClient.invalidateQueries({ queryKey: MISSING_UPDATES_KEYS.all });
    },
    onError: (error) => {
      console.error('[useSendUpdateReminder] Request failed:', error);
    },
  });
}
