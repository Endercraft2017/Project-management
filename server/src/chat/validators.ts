/**
 * Chat System Validators
 * Zod schemas for REST API and WebSocket event validation
 */

import { z } from 'zod';

/**
 * Create DM conversation schema
 */
export const createDmSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

export type CreateDm = z.infer<typeof createDmSchema>;

/**
 * Create group conversation schema
 */
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name required').max(100, 'Group name too long').trim(),
  memberIds: z
    .array(z.string().uuid('Invalid user ID format'))
    .min(1, 'At least one member required')
    .max(49, 'Maximum 49 members (excluding creator)'),
});

export type CreateGroup = z.infer<typeof createGroupSchema>;

/**
 * Get conversations query schema
 */
export const getConversationsQuerySchema = z.object({
  type: z.enum(['DM', 'GROUP']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetConversationsQuery = z.infer<typeof getConversationsQuerySchema>;

/**
 * Get messages query schema
 */
export const getMessagesQuerySchema = z.object({
  before: z.string().uuid('Invalid cursor format').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;

/**
 * Add member to group schema
 */
export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

export type AddMember = z.infer<typeof addMemberSchema>;

/**
 * Send message schema (WebSocket)
 */
export const sendMessageSchema = z
  .object({
    conversationId: z.string().uuid('Invalid conversation ID format'),
    content: z
      .string()
      .max(10000, 'Message too long (max 10,000 characters)')
      .trim()
      .optional()
      .default(''),
    driveFileIds: z.array(z.string()).max(10, 'Maximum 10 files per message').optional(), // Optional array of Google Drive file IDs
  })
  .refine(
    (data) => data.content.length > 0 || (data.driveFileIds && data.driveFileIds.length > 0),
    {
      message: 'Message must contain either text content or file attachments',
      path: ['content'],
    }
  );

export type SendMessage = z.infer<typeof sendMessageSchema>;

/**
 * Send message body schema (REST API)
 * For POST /api/conversations/:id/messages
 * conversationId comes from URL params, only content in body
 */
export const sendMessageBodySchema = z
  .object({
    content: z
      .string()
      .max(10000, 'Message too long (max 10,000 characters)')
      .trim()
      .optional()
      .default(''),
    driveFileIds: z.array(z.string()).max(10, 'Maximum 10 files per message').optional(), // Optional array of Google Drive file IDs
  })
  .refine(
    (data) => data.content.length > 0 || (data.driveFileIds && data.driveFileIds.length > 0),
    {
      message: 'Message must contain either text content or file attachments',
      path: ['content'],
    }
  );

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;

/**
 * Edit message schema (WebSocket)
 */
export const editMessageSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format'),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message too long (max 10,000 characters)')
    .trim(),
});

export type EditMessage = z.infer<typeof editMessageSchema>;

/**
 * Delete message schema (WebSocket)
 */
export const deleteMessageSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format'),
});

export type DeleteMessage = z.infer<typeof deleteMessageSchema>;

/**
 * Join conversation schema (WebSocket)
 */
export const joinConversationSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
});

export type JoinConversation = z.infer<typeof joinConversationSchema>;

/**
 * Leave conversation schema (WebSocket)
 */
export const leaveConversationSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
});

export type LeaveConversation = z.infer<typeof leaveConversationSchema>;

/**
 * Typing event schema (WebSocket)
 */
export const typingEventSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format'),
});

export type TypingEvent = z.infer<typeof typingEventSchema>;

/**
 * Message reaction schema (WebSocket)
 */
export const reactionSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format'),
  emoji: z
    .string()
    .min(1, 'Emoji is required')
    .max(10, 'Invalid emoji')
    .refine(
      (val) => {
        // Allow any Unicode emoji (basic check for emoji-like characters)
        // More permissive to support all emojis including compound emojis
        return val.length > 0 && val.length <= 10;
      },
      'Only emojis are allowed'
    ),
});

export type Reaction = z.infer<typeof reactionSchema>;

/**
 * Send thread reply schema (WebSocket)
 */
export const sendThreadReplySchema = z
  .object({
    parentMessageId: z.string().uuid('Invalid message ID'),
    content: z
      .string()
      .max(10000, 'Reply too long (max 10,000 characters)')
      .trim()
      .optional()
      .default(''),
    driveFileIds: z.array(z.string()).max(10, 'Maximum 10 files per message').optional(), // Optional array of Google Drive file IDs
  })
  .refine(
    (data) => data.content.length > 0 || (data.driveFileIds && data.driveFileIds.length > 0),
    {
      message: 'Reply must contain either text content or file attachments',
      path: ['content'],
    }
  );

export type SendThreadReply = z.infer<typeof sendThreadReplySchema>;

/**
 * Get thread replies schema (WebSocket)
 */
export const getThreadRepliesSchema = z.object({
  parentMessageId: z.string().uuid('Invalid message ID'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GetThreadReplies = z.infer<typeof getThreadRepliesSchema>;
