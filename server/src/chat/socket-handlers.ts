/**
 * Socket.IO Event Handlers
 * Handle real-time WebSocket events
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { AuthenticatedSocket, messageRateLimiter, typingRateLimiter } from './socket-middleware';
import * as conversationService from './conversation-service';
import * as messageService from './message-service';
import * as threadService from './thread-service';
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  joinConversationSchema,
  leaveConversationSchema,
  typingEventSchema,
  reactionSchema,
  sendThreadReplySchema,
  getThreadRepliesSchema,
} from './validators';

/**
 * Track online users
 * Map: userId -> Set of socket IDs
 */
const onlineUsers = new Map<string, Set<string>>();

/**
 * Track user conversations
 * Map: socketId -> Set of conversation IDs
 */
const userConversations = new Map<string, Set<string>>();

/**
 * Register all Socket.IO event handlers
 */
export function registerSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;
    const userName = authSocket.userName;

    console.log(`[Socket.IO] User ${userName} (${userId}) connected with socket ID: ${socket.id}`);

    // Join user's personal room for direct notifications (mentions, etc.)
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} joined personal room: user:${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Initialize conversation set for this socket
    userConversations.set(socket.id, new Set());

    // Broadcast user online status
    socket.broadcast.emit('user_status_changed', {
      userId,
      userName,
      status: 'online',
    });

    /**
     * Event: join_conversation
     * User joins a conversation room
     */
    socket.on('join_conversation', async (data, callback) => {
      try {
        // Validate input
        const parsed = joinConversationSchema.parse(data);
        const { conversationId } = parsed;

        // Verify user is a member
        const isMember = await conversationService.isMemberOfConversation(
          conversationId,
          userId
        );

        if (!isMember) {
          if (callback) callback({ success: false, error: 'Not a member of this conversation' });
          return;
        }

        // Join Socket.IO room
        socket.join(`conversation:${conversationId}`);

        // Track conversation for this socket
        userConversations.get(socket.id)!.add(conversationId);

        // Update last read timestamp
        await conversationService.updateLastReadAt(conversationId, userId);

        console.log(`[Socket.IO] User ${userName} joined conversation ${conversationId}`);

        // Send success acknowledgment
        if (callback) callback({ success: true, data: { conversationId } });

        // Notify others in conversation
        socket.to(`conversation:${conversationId}`).emit('user_joined', {
          userId,
          userName,
          conversationId,
        });
      } catch (error: any) {
        console.error('[Socket.IO] Error in join_conversation:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: leave_conversation
     * User leaves a conversation room
     */
    socket.on('leave_conversation', async (data, callback) => {
      try {
        // Validate input
        const parsed = leaveConversationSchema.parse(data);
        const { conversationId } = parsed;

        // Leave Socket.IO room
        socket.leave(`conversation:${conversationId}`);

        // Remove from tracking
        userConversations.get(socket.id)?.delete(conversationId);

        // Update last read timestamp
        await conversationService.updateLastReadAt(conversationId, userId);

        console.log(`[Socket.IO] User ${userName} left conversation ${conversationId}`);

        // Send success acknowledgment
        if (callback) callback({ success: true, data: { conversationId } });

        // Notify others in conversation
        socket.to(`conversation:${conversationId}`).emit('user_left', {
          userId,
          userName,
          conversationId,
        });
      } catch (error: any) {
        console.error('[Socket.IO] Error in leave_conversation:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: send_message
     * User sends a message to a conversation
     */
    socket.on('send_message', async (data, callback) => {
      try {
        // Rate limiting
        if (!messageRateLimiter.check(socket.id)) {
          if (callback)
            callback({ success: false, error: 'Too many messages. Please slow down.' });
          return;
        }

        // Validate input
        const parsed = sendMessageSchema.parse(data);
        const { conversationId, content, driveFileIds } = parsed;

        // Send message via service (includes mention extraction and file attachments)
        const message = await messageService.sendMessage(conversationId, userId, content, driveFileIds);

        console.log(`[Socket.IO] Message sent by ${userName} to conversation ${conversationId}${driveFileIds && driveFileIds.length > 0 ? ` with ${driveFileIds.length} attachment(s)` : ''}`);

        // Send acknowledgment to sender
        if (callback) callback({ success: true, data: message });

        // Broadcast to all in room (including sender for consistency)
        io.to(`conversation:${conversationId}`).emit('new_message', message);

        // Notify all conversation members (for notification bell updates)
        // Get all members of this conversation
        const members = await conversationService.getConversationMembers(conversationId);
        members.forEach((member) => {
          // Don't notify the sender
          if (member.id !== userId) {
            // Emit to user's personal room (they receive this even if not in conversation room)
            io.to(`user:${member.id}`).emit('new_message', message);
          }
        });

        // Send mention notifications to mentioned users
        if (message.mentions && message.mentions.length > 0) {
          message.mentions.forEach((mentionedUserId) => {
            // Don't notify yourself
            if (mentionedUserId !== userId) {
              io.to(`user:${mentionedUserId}`).emit('mention_notification', {
                messageId: message.id,
                conversationId: message.conversationId,
                senderId: userId,
                senderName: userName,
                content: message.content,
                isThread: false,
              });
            }
          });
        }
      } catch (error: any) {
        console.error('[Socket.IO] Error in send_message:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: edit_message
     * User edits their message
     */
    socket.on('edit_message', async (data, callback) => {
      try {
        // Validate input
        const parsed = editMessageSchema.parse(data);
        const { messageId, content } = parsed;

        // Edit message via service
        const updatedMessage = await messageService.editMessage(messageId, userId, content);

        console.log(`[Socket.IO] Message ${messageId} edited by ${userName}`);

        // Send acknowledgment to sender
        if (callback) callback({ success: true, data: updatedMessage });

        // Broadcast to all in room
        io.to(`conversation:${updatedMessage.conversationId}`).emit(
          'message_edited',
          updatedMessage
        );
      } catch (error: any) {
        console.error('[Socket.IO] Error in edit_message:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: delete_message
     * User deletes their message or admin deletes any message
     */
    socket.on('delete_message', async (data, callback) => {
      try {
        // Validate input
        const parsed = deleteMessageSchema.parse(data);
        const { messageId } = parsed;

        // Delete message via service
        const deletedMessage = await messageService.deleteMessage(messageId, userId);

        console.log(`[Socket.IO] Message ${messageId} deleted by ${userName}`);

        // Send acknowledgment to sender
        if (callback) callback({ success: true, data: deletedMessage });

        // Broadcast to all in room
        io.to(`conversation:${deletedMessage.conversationId}`).emit('message_deleted', {
          id: deletedMessage.id,
          conversationId: deletedMessage.conversationId,
          isDeleted: deletedMessage.isDeleted,
        });
      } catch (error: any) {
        console.error('[Socket.IO] Error in delete_message:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: typing_start
     * User starts typing in a conversation
     */
    socket.on('typing_start', async (data, callback) => {
      try {
        // Rate limiting
        if (!typingRateLimiter.check(socket.id)) {
          return;
        }

        // Validate input
        const parsed = typingEventSchema.parse(data);
        const { conversationId } = parsed;

        // Verify user is a member
        const isMember = await conversationService.isMemberOfConversation(
          conversationId,
          userId
        );

        if (!isMember) {
          if (callback) callback({ success: false, error: 'Not a member of this conversation' });
          return;
        }

        // Broadcast to others in room (exclude sender)
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId,
          userName,
          conversationId,
        });

        if (callback) callback({ success: true });
      } catch (error: any) {
        console.error('[Socket.IO] Error in typing_start:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: typing_stop
     * User stops typing in a conversation
     */
    socket.on('typing_stop', async (data, callback) => {
      try {
        // Validate input
        const parsed = typingEventSchema.parse(data);
        const { conversationId } = parsed;

        // Verify user is a member
        const isMember = await conversationService.isMemberOfConversation(
          conversationId,
          userId
        );

        if (!isMember) {
          if (callback) callback({ success: false, error: 'Not a member of this conversation' });
          return;
        }

        // Broadcast to others in room (exclude sender)
        socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
          userId,
          userName,
          conversationId,
        });

        if (callback) callback({ success: true });
      } catch (error: any) {
        console.error('[Socket.IO] Error in typing_stop:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: add_reaction
     * User adds reaction to a message
     */
    socket.on('add_reaction', async (data, callback) => {
      try {
        // Validate input
        const parsed = reactionSchema.parse(data);
        const { messageId, emoji } = parsed;

        // Add reaction via service
        const result = await messageService.addReaction(messageId, userId, emoji);

        console.log(`[Socket.IO] Reaction ${emoji} added by ${userName} to message ${messageId}`);

        // Send acknowledgment
        if (callback) callback({ success: true, data: result });

        // Broadcast to all in room
        io.to(`conversation:${result.conversationId}`).emit('reaction_added', {
          messageId: result.id,
          reactions: result.reactions,
          userId,
          emoji,
        });
      } catch (error: any) {
        console.error('[Socket.IO] Error in add_reaction:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: remove_reaction
     * User removes their reaction from a message
     */
    socket.on('remove_reaction', async (data, callback) => {
      try {
        // Validate input
        const parsed = reactionSchema.parse(data);
        const { messageId, emoji } = parsed;

        // Remove reaction via service
        const result = await messageService.removeReaction(messageId, userId, emoji);

        console.log(`[Socket.IO] Reaction ${emoji} removed by ${userName} from message ${messageId}`);

        // Send acknowledgment
        if (callback) callback({ success: true, data: result });

        // Broadcast to all in room
        io.to(`conversation:${result.conversationId}`).emit('reaction_removed', {
          messageId: result.id,
          reactions: result.reactions,
          userId,
          emoji,
        });
      } catch (error: any) {
        console.error('[Socket.IO] Error in remove_reaction:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: send_thread_reply
     * User sends a reply in a thread
     */
    socket.on('send_thread_reply', async (data, callback) => {
      try {
        // Rate limiting
        if (!messageRateLimiter.check(socket.id)) {
          if (callback)
            callback({ success: false, error: 'Too many messages. Please slow down.' });
          return;
        }

        // Validate input
        const parsed = sendThreadReplySchema.parse(data);
        const { parentMessageId, content } = parsed;

        // Send reply via service (includes mention extraction)
        const reply = await threadService.sendThreadReply(parentMessageId, userId, content);

        console.log(
          `[Socket.IO] Thread reply sent by ${userName} to message ${parentMessageId}`
        );

        // Send acknowledgment
        if (callback) callback({ success: true, data: reply });

        // Broadcast to all in conversation room
        io.to(`conversation:${reply.conversationId}`).emit('thread_reply_added', {
          reply,
          parentMessageId,
        });

        // Notify all conversation members (for notification bell updates)
        const members = await conversationService.getConversationMembers(reply.conversationId);
        members.forEach((member) => {
          // Don't notify the sender
          if (member.id !== userId) {
            // Emit new_message to user's personal room for notification updates
            io.to(`user:${member.id}`).emit('new_message', reply);
          }
        });

        // Send mention notifications to mentioned users in thread reply
        if (reply.mentions && reply.mentions.length > 0) {
          reply.mentions.forEach((mentionedUserId) => {
            // Don't notify yourself
            if (mentionedUserId !== userId) {
              io.to(`user:${mentionedUserId}`).emit('mention_notification', {
                messageId: reply.id,
                conversationId: reply.conversationId,
                senderId: userId,
                senderName: userName,
                content: reply.content,
                isThread: true,
                parentMessageId,
              });
            }
          });
        }
      } catch (error: any) {
        console.error('[Socket.IO] Error in send_thread_reply:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: get_thread_replies
     * Fetch replies for a thread
     */
    socket.on('get_thread_replies', async (data, callback) => {
      try {
        const parsed = getThreadRepliesSchema.parse(data);
        const { parentMessageId, cursor, limit } = parsed;

        const result = await threadService.getThreadReplies(
          parentMessageId,
          userId,
          limit,
          cursor
        );

        if (callback) callback({ success: true, data: result });
      } catch (error: any) {
        console.error('[Socket.IO] Error in get_thread_replies:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: disconnect
     * User disconnects from server
     */
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User ${userName} (${userId}) disconnected`);

      // Remove socket from online users
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          // Broadcast user offline status
          socket.broadcast.emit('user_status_changed', {
            userId,
            userName,
            status: 'offline',
          });
        }
      }

      // Clean up conversation tracking
      userConversations.delete(socket.id);

      // Clean up rate limiters
      messageRateLimiter.clear(socket.id);
      typingRateLimiter.clear(socket.id);
    });

    /**
     * Event: error
     * Handle Socket.IO errors
     */
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Socket error for user ${userName}:`, error);
    });
  });
}

/**
 * Get online status for a user
 */
export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return !!(sockets && sockets.size > 0);
}

/**
 * Get all online users
 */
export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

/**
 * Get socket count for a user
 */
export function getUserSocketCount(userId: string): number {
  return onlineUsers.get(userId)?.size || 0;
}
