/**
 * TanStack Query Hooks for Notifications
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UnreadNotification {
  id: string;
  type: 'message' | 'task_assigned' | 'update_reminder';
  conversationId?: string;
  conversationName?: string;
  conversationType?: 'DM' | 'GROUP';
  messageId?: string;
  messageContent?: string;
  senderId?: string;
  senderName?: string;
  senderPicture?: string;
  taskId?: string;
  taskName?: string;
  assignedById?: string;
  assignedByName?: string;
  title?: string;
  message?: string;
  metadata?: any;
  link?: string;
  createdAt: string;
  isThreadReply?: boolean;
  parentMessageId?: string;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  count: () => [...notificationKeys.all, 'count'] as const,
};

type NotificationData = {
  notifications: UnreadNotification[];
  count: number;
};

/**
 * Get all unread notifications for the current user
 */
export function useNotifications(
  limit: number = 50,
  options?: Partial<UseQueryOptions<NotificationData>>
) {
  return useQuery({
    queryKey: [...notificationKeys.list(), limit],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: NotificationData;
      }>(`/api/conversations/notifications?limit=${limit}`);

      // Filter out task notifications that have been marked as seen
      const seenTasks = JSON.parse(localStorage.getItem('seenTaskNotifications') || '[]');
      const filteredNotifications = response.data.data.notifications.filter(
        (notif) => notif.type !== 'task_assigned' || !seenTasks.includes(notif.taskId)
      );

      return {
        notifications: filteredNotifications,
        count: filteredNotifications.length,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - rely on WebSocket for updates
    refetchOnWindowFocus: false, // Disabled - using WebSocket events instead
    ...options, // Allow overriding with custom options like select
  });
}

/**
 * Get total unread count for the current user
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: { count: number };
      }>('/api/conversations/unread-count');
      return response.data.data.count;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - rely on WebSocket for updates
    refetchOnWindowFocus: false, // Disabled - using WebSocket events instead
    // Optimize: Only trigger re-render when count value actually changes
    notifyOnChangeProps: ['data', 'error'],
  });
}

/**
 * Optimized hook to get just the unread count from notifications query
 * Prevents re-renders when notification list changes but count stays same
 */
export function useNotificationCount() {
  return useQuery({
    queryKey: [...notificationKeys.list(), 50],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: NotificationData;
      }>('/api/conversations/notifications?limit=50');
      return response.data.data.count;
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data'],
  });
}
