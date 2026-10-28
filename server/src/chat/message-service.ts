/**
 * Message Service
 * Business logic for message management
 */

import prisma from '@/database/client';
import { lockMessage, lockConversationMember } from './transaction-policy';
import { isMemberOfConversation, isAdminOfConversation } from './conversation-service';
import { extractMentions, validateMentions, logMentionExtraction } from '@/lib/mentions';

/**
 * Send a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  driveFileIds?: string[]
) {
  if (driveFileIds?.length) throw Object.assign(new Error('Google Drive attachments are disabled'), { status: 503 });

  // Verify user is a member
  const isMember = await isMemberOfConversation(conversationId, senderId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // Verify conversation exists and get members
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Extract and validate mentions
  const mentionIds = extractMentions(content);
  const validMentions = await validateMentions(mentionIds, conversationId);

  const attachmentRecords: any[] = [];

  // Create message with mentions and attachments
  const message = await prisma.$transaction(async (tx) => {
    await lockConversationMember(tx, conversationId, senderId);
    const message = await tx.message.create({
    data: {
      conversationId,
      senderId,
      content: content.trim(),
      mentions: validMentions,
      driveAttachments: {
        create: attachmentRecords,
      },
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          picture: true,
        },
      },
      driveAttachments: true,
    },
  });
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  });

  // Log mention extraction for audit
  if (validMentions.length > 0) {
    logMentionExtraction(message.id, senderId, validMentions);
  }



  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      picture: message.sender.picture,
    },
    content: message.content,
    mentions: message.mentions,
    driveAttachments: message.driveAttachments.map((a) => ({
      id: a.id,
      driveFileId: a.driveFileId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize.toString(),
      thumbnailLink: a.thumbnailLink || undefined,
      webViewLink: a.webViewLink,
      webContentLink: a.webContentLink || undefined,
      iconLink: a.iconLink || undefined,
    })),
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    threadRepliesCount: 0, // New messages start with 0 replies
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
) {
  const updatedMessage = await prisma.$transaction(async (tx) => {
    const message = await lockMessage(tx, messageId);
    if (!message) throw new Error('Message not found');
    await lockConversationMember(tx, message.conversationId, userId);
    if (message.senderId !== userId) throw new Error('You can only edit your own messages');
    if (message.isDeleted) throw new Error('Cannot edit deleted messages');
    if (message.createdAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) throw new Error('Messages can only be edited within 24 hours');
    return tx.message.update({
      where: { id: messageId }, data: { content: newContent.trim(), isEdited: true, updatedAt: new Date() },
      include: { sender: { select: { id: true, name: true, picture: true } } },
    });
  });

  console.log(`[Audit] User ${userId} edited message ${messageId}`);

  return {
    id: updatedMessage.id,
    conversationId: updatedMessage.conversationId,
    senderId: updatedMessage.senderId,
    senderName: updatedMessage.sender.name,
    senderAvatarUrl: updatedMessage.sender.picture,
    content: updatedMessage.content,
    isEdited: updatedMessage.isEdited,
    isDeleted: updatedMessage.isDeleted,
    createdAt: updatedMessage.createdAt,
    updatedAt: updatedMessage.updatedAt,
  };
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string, userId: string) {
  const candidate = await prisma.message.findUnique({ where: { id: messageId }, select: { parentMessageId: true } });
  if (!candidate) throw new Error('Message not found');
  if (candidate.parentMessageId) {
    const { deleteThreadReply } = await import('./thread-service');
    return deleteThreadReply(messageId, userId);
  }
  const deletedMessage = await prisma.$transaction(async (tx) => {
    const message = await lockMessage(tx, messageId);
    if (!message) throw new Error('Message not found');
    if (message.parentMessageId) throw new Error('Message changed; retry');
    const member = await lockConversationMember(tx, message.conversationId, userId);
    if (message.senderId !== userId && !member.isAdmin) throw new Error('You can only delete your own messages or be a group admin');
    if (message.isDeleted) throw new Error('Message already deleted');
    return tx.message.update({ where: { id: messageId }, data: { isDeleted: true } });
  });

  return {
    id: deletedMessage.id,
    conversationId: deletedMessage.conversationId,
    isDeleted: deletedMessage.isDeleted,
  };
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          picture: true,
        },
      },
    },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // Verify user is a member of the conversation
  const isMember = await isMemberOfConversation(message.conversationId, userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: message.sender.name,
    senderAvatarUrl: message.sender.picture,
    content: message.isDeleted ? '[deleted]' : message.content,
    isEdited: message.isEdited,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/**
 * Check if user can edit a message
 */
export async function canEditMessage(messageId: string, userId: string): Promise<boolean> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.isDeleted || message.senderId !== userId) {
    return false;
  }

  // Check if within 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return message.createdAt >= twentyFourHoursAgo;
}

/**
 * Check if user can delete a message
 */
export async function canDeleteMessage(
  messageId: string,
  userId: string
): Promise<boolean> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.isDeleted) {
    return false;
  }

  // User can delete if they're the sender
  if (message.senderId === userId) {
    return true;
  }

  // Or if they're an admin of the conversation
  return await isAdminOfConversation(message.conversationId, userId);
}

/** Every mutation serializes the reaction read, authorization and write on the message row. */
async function changeReaction(messageId: string, userId: string, emoji: string, adding: boolean): Promise<{ id: string; reactions: any; conversationId: string }> {
  if (typeof emoji !== 'string' || emoji.length < 1 || emoji.length > 10 || ['__proto__', 'prototype', 'constructor'].includes(emoji)) throw Object.assign(new Error('Invalid emoji'), { status: 400 });
  return prisma.$transaction(async (tx) => {
    const message = await lockMessage(tx, messageId);
    if (!message) throw new Error('Message not found');
    await lockConversationMember(tx, message.conversationId, userId);
    if (adding && message.isDeleted) throw new Error('Cannot react to deleted messages');
    const reactions: Record<string, string[]> = Object.create(null);
    if (message.reactions !== null) {
      if (typeof message.reactions !== 'object' || Array.isArray(message.reactions)) throw new Error('Invalid stored reactions');
      for (const [key, value] of Object.entries(message.reactions)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid stored reactions');
        if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) throw new Error('Invalid stored reactions');
        reactions[key] = [...new Set(value as string[])];
      }
    }
    const users = reactions[emoji] || [];
    if (adding) reactions[emoji] = [...new Set([...users, userId])];
    else {
      const remaining = users.filter((id) => id !== userId);
      if (remaining.length) reactions[emoji] = remaining;
      else delete reactions[emoji];
    }
    const updated = await tx.message.update({ where: { id: messageId }, data: { reactions } });
    return { id: updated.id, reactions: updated.reactions, conversationId: updated.conversationId };
  });
}
export async function addReaction(messageId: string, userId: string, emoji: string): Promise<{ id: string; reactions: any; conversationId: string }> {
  return changeReaction(messageId, userId, emoji, true);
}
export async function removeReaction(messageId: string, userId: string, emoji: string): Promise<{ id: string; reactions: any; conversationId: string }> {
  return changeReaction(messageId, userId, emoji, false);
}
