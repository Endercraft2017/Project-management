/**
 * Notification Service
 * Handles fetching unread messages across all conversations for a user
 */

import { prisma } from '@/database/client';

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

/**
 * Get all unread messages for a user across all conversations
 * Returns messages sorted by most recent first
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50
): Promise<UnreadNotification[]> {
  // Get all conversations the user is a member of
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  picture: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // For each conversation, get unread messages
  const notifications: UnreadNotification[] = [];

  for (const membership of memberships) {
    const lastReadAt = membership.lastReadAt || new Date(0);
    const conversation = membership.conversation;

    // Get unread messages in this conversation
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        createdAt: { gt: lastReadAt },
        senderId: { not: userId }, // Don't include user's own messages
        isDeleted: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit per conversation to avoid overwhelming results
    });

    // Format messages as notifications
    for (const message of unreadMessages) {
      // Determine conversation name
      let conversationName: string;
      if (conversation.type === 'GROUP') {
        conversationName = conversation.name || 'Unnamed Group';
      } else {
        // For DM, get the other person's name
        const otherMember = conversation.members.find(
          (m) => m.userId !== userId
        );
        conversationName = otherMember?.user?.name || 'Unknown User';
      }

      notifications.push({
        id: `msg-${conversation.id}-${message.id}`,
        type: 'message',
        conversationId: conversation.id,
        conversationName,
        conversationType: conversation.type,
        messageId: message.id,
        messageContent: message.content,
        senderId: message.sender.id,
        senderName: message.sender.name,
        senderPicture: message.sender.picture || undefined,
        createdAt: message.createdAt.toISOString(),
        isThreadReply: !!message.parentMessageId,
        parentMessageId: message.parentMessageId || undefined,
      });
    }
  }

  // Get recent task assignments (last 24 hours only for notifications)
  // This prevents showing old tasks as "new" notifications
  // Accept optional lastSeenTaskTime to filter out already-seen tasks
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const taskAssignments = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      updatedAt: { gte: oneDayAgo },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 10,
  });

  // Add task notifications
  for (const task of taskAssignments) {
    notifications.push({
      id: `task-${task.id}`,
      type: 'task_assigned',
      taskId: task.id,
      taskName: task.taskName,
      assignedById: task.createdById,
      assignedByName: task.createdBy?.name || 'Unknown',
      createdAt: task.updatedAt.toISOString(),
    });
  }

  // Get persistent notifications (update_reminder, system, etc.)
  const persistentNotifications = await prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  // Add persistent notifications
  for (const notif of persistentNotifications) {
    notifications.push({
      id: notif.id,
      type: notif.type === 'UPDATE_REMINDER' ? 'update_reminder' : 'message',
      title: notif.title,
      message: notif.message,
      metadata: notif.metadata,
      link: notif.link || undefined,
      createdAt: notif.createdAt.toISOString(),
    });
  }

  // Sort all notifications by most recent first
  notifications.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Return limited results
  return notifications.slice(0, limit);
}

/**
 * Get total unread count across all conversations for a user
 */
export async function getUserUnreadCount(userId: string): Promise<number> {
  // Get all conversations the user is a member of
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  });

  let totalUnread = 0;

  for (const membership of memberships) {
    const lastReadAt = membership.lastReadAt || new Date(0);

    const count = await prisma.message.count({
      where: {
        conversationId: membership.conversationId,
        createdAt: { gt: lastReadAt },
        senderId: { not: userId },
        isDeleted: false,
      },
    });

    totalUnread += count;
  }

  return totalUnread;
}

/**
 * Create a persistent notification for a user
 */
export async function createNotification(data: {
  userId: string;
  type: 'UPDATE_REMINDER' | 'SYSTEM';
  title: string;
  message: string;
  metadata?: any;
  link?: string;
}) {
  return await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata,
      link: data.link,
    },
  });
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
