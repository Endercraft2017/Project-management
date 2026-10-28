/**
 * TanStack Query Hooks for Notifications
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCurrentUser } from "./useUsers";
import { seenTaskIds } from "@/lib/notification-storage";

export interface UnreadNotification {
  id: string;
  type: "message" | "task_assigned" | "update_reminder" | "system";
  conversationId?: string;
  conversationName?: string;
  conversationType?: "DM" | "GROUP";
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
  metadata?: {
    missingDates?: string[];
    noteId?: string;
    reminderId?: string;
    [key: string]: unknown;
  };
  link?: string;
  createdAt: string;
  isThreadReply?: boolean;
  parentMessageId?: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  count: () => [...notificationKeys.all, "count"] as const,
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
  options?: Partial<UseQueryOptions<NotificationData>>,
) {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: [...notificationKeys.list(), limit, user?.tenant?.id, user?.id],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: NotificationData;
      }>(`/api/conversations/notifications?limit=${limit}`);

      // Filter out task notifications that have been marked as seen
      const seenTasks = seenTaskIds(user);
      const filteredNotifications = response.data.data.notifications.filter(
        (notif) =>
          notif.type !== "task_assigned" ||
          !notif.taskId ||
          !seenTasks.includes(notif.taskId),
      );

      return {
        notifications: filteredNotifications,
        count: filteredNotifications.length,
      };
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 30000, // Durable worker notifications arrive through the database.
    refetchOnWindowFocus: true,
    ...options, // Allow overriding with custom options like select
  });
}

/**
 * Get total unread count for the current user
 */
export function useUnreadCount() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: [...notificationKeys.count(), user?.tenant?.id, user?.id],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: { count: number };
      }>("/api/conversations/unread-count");
      return response.data.data.count;
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 30000, // Durable worker notifications arrive through the database.
    refetchOnWindowFocus: true,
    // Optimize: Only trigger re-render when count value actually changes
    notifyOnChangeProps: ["data", "error"],
  });
}

/**
 * Optimized hook to get just the unread count from notifications query
 * Prevents re-renders when notification list changes but count stays same
 */
export function useNotificationCount() {
  // Reuse the list query's data shape; a number under the same cache key
  // corrupts other observers of that query.
  const result = useNotifications(50);
  return { ...result, data: result.data?.count };
}
