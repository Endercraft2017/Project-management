/**
 * Chat Controller
 * Request handlers for REST API endpoints
 */

import { Request, Response } from 'express';
import * as conversationService from './conversation-service';
import * as messageService from './message-service';
import * as notificationService from './notification-service';
import {
  createDmSchema,
  createGroupSchema,
  getConversationsQuerySchema,
  getMessagesQuerySchema,
  addMemberSchema,
  sendMessageBodySchema,
} from './validators';
import { ZodError } from 'zod';
import { getSocketServer } from './socket-server';

/**
 * List conversations for authenticated user
 */
export async function listConversations(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Validate query parameters
    const query = getConversationsQuerySchema.parse(req.query);

    const result = await conversationService.listConversations(
      userId,
      { type: query.type },
      { page: query.page, limit: query.limit }
    );

    res.json({
      success: true,
      data: result.conversations,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('[Chat] Error listing conversations:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list conversations',
    });
  }
}

/**
 * Create DM conversation
 */
export async function createDm(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Validate request body
    const data = createDmSchema.parse(req.body);

    const conversation = await conversationService.createDmConversation(userId, data.userId);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('[Chat] Error creating DM:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (
      error.message.includes('Cannot create DM with yourself') ||
      error.message.includes('not found or inactive')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create DM conversation',
    });
  }
}

/**
 * Create group conversation
 */
export async function createGroup(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Validate request body
    const data = createGroupSchema.parse(req.body);

    const conversation = await conversationService.createGroupConversation(
      userId,
      data.name,
      data.memberIds
    );

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('[Chat] Error creating group:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (
      error.message.includes('must have at least') ||
      error.message.includes('cannot have more than') ||
      error.message.includes('not found or inactive')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create group conversation',
    });
  }
}

/**
 * Get conversation messages
 */
export async function getMessages(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Validate query parameters
    const query = getMessagesQuerySchema.parse(req.query);

    const result = await conversationService.getConversationMessages(
      conversationId,
      userId,
      query.before,
      query.limit
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Chat] Error getting messages:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('Not a member')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get messages',
    });
  }
}

/**
 * Search messages in conversation (includes threads)
 */
export async function searchMessages(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Search query is required',
      });
    }

    const results = await conversationService.searchConversationMessages(
      conversationId,
      userId,
      query.trim()
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('[Chat] Error searching messages:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('Not a member')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to search messages',
    });
  }
}

/**
 * Add member to group conversation
 */
export async function addMember(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Validate request body
    const data = addMemberSchema.parse(req.body);

    const member = await conversationService.addMember(
      conversationId,
      data.userId,
      userId
    );

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error: any) {
    console.error('[Chat] Error adding member:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (
      error.message.includes('Only group admins') ||
      error.message.includes('Cannot add members to DM')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    if (
      error.message.includes('already a member') ||
      error.message.includes('maximum capacity')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to add member',
    });
  }
}

/**
 * Remove member from group conversation
 */
export async function removeMember(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const userIdToRemove = req.params.userId;

    const result = await conversationService.removeMember(
      conversationId,
      userIdToRemove,
      userId
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[Chat] Error removing member:', error.message);

    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (
      error.message.includes('Only group admins') ||
      error.message.includes('Cannot remove members from DM')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    if (error.message.includes('Cannot remove the last admin')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to remove member',
    });
  }
}

/**
 * Get members of a conversation (for mentions autocomplete)
 */
export async function getMembers(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { id: conversationId } = req.params;

    // Verify user is a member of the conversation
    const isMember = await conversationService.isMemberOfConversation(conversationId, userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Not a member of this conversation',
      });
    }

    // Get conversation members
    const members = await conversationService.getConversationMembers(conversationId);

    res.json({
      success: true,
      data: { members },
    });
  } catch (error: any) {
    console.error('[Chat] Error getting members:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get members',
    });
  }
}

/**
 * Send a message to a conversation (REST API endpoint)
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Validate request body (only content, conversationId from URL)
    const data = sendMessageBodySchema.parse(req.body);

    // Verify user is a member
    const isMember = await conversationService.isMemberOfConversation(conversationId, userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Not a member of this conversation',
      });
    }

    // Send message using message service (with optional Drive attachments)
    const message = await messageService.sendMessage(conversationId, userId, data.content, data.driveFileIds);

    console.log('[Chat] Message sent via REST API:', message.id);

    // Broadcast to all users in the conversation room via Socket.IO
    try {
      const io = getSocketServer();
      // Deep clone to ensure all BigInts are converted to strings before emitting
      const serializedMessage = JSON.parse(JSON.stringify(message, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
      io.to(`conversation:${conversationId}`).emit('new_message', serializedMessage);
      console.log('[Chat] Broadcasted new_message event to conversation:', conversationId);

      // Send mention notifications to mentioned users
      if (message.mentions && message.mentions.length > 0) {
        message.mentions.forEach((mentionedUserId) => {
          if (mentionedUserId !== userId) {
            io.to(`user:${mentionedUserId}`).emit('mention_notification', {
              messageId: message.id,
              conversationId: message.conversationId,
              senderId: userId,
              content: message.content,
            });
          }
        });
      }
    } catch (socketError: any) {
      console.error('[Chat] Failed to broadcast message via Socket.IO:', socketError.message);
      // Don't fail the request if Socket.IO broadcast fails
    }

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error('[Chat] Error sending message:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('Not a member')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to send message',
    });
  }
}

/**
 * Get all unread notifications for authenticated user
 */
export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const notifications = await notificationService.getUserNotifications(
      userId,
      limit
    );

    res.json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
      },
    });
  } catch (error: any) {
    console.error('[Chat] Error getting notifications:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get notifications',
    });
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { notificationId } = req.params;

    const updated = await notificationService.markNotificationAsRead(notificationId, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('[Chat] Error marking notification as read:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to mark notification as read',
    });
  }
}

/**
 * Get total unread count for authenticated user
 */
export async function getUnreadCount(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUserUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('[Chat] Error getting unread count:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get unread count',
    });
  }
}
