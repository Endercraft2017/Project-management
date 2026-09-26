/**
 * Message Service
 * Business logic for message management
 */

import prisma from '@/database/client';
import { isMemberOfConversation, isAdminOfConversation } from './conversation-service';
import { extractMentions, validateMentions, logMentionExtraction } from '@/lib/mentions';
import { getFileMetadata, shareFileWithUsers } from '@/services/drive-service';

/**
 * Send a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  driveFileIds?: string[]
) {
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

  // Process Drive attachments if provided
  let attachmentRecords: any[] = [];
  if (driveFileIds && driveFileIds.length > 0) {
    // Get other conversation members' emails for file sharing
    const memberEmails = conversation.members
      .filter((m) => m.user && m.user.id !== senderId)
      .map((m) => m.user!.email);

    // Fetch metadata and share files with conversation members
    for (const fileId of driveFileIds) {
      try {
        // Get file metadata from Drive
        const metadata = await getFileMetadata(senderId, fileId);

        // Share file with all conversation members
        if (memberEmails.length > 0) {
          await shareFileWithUsers(senderId, fileId, memberEmails, 'reader');
        }

        // Prepare attachment record
        attachmentRecords.push({
          driveFileId: fileId,
          fileName: metadata.name,
          mimeType: metadata.mimeType,
          fileSize: BigInt(metadata.size || '0'),
          thumbnailLink: metadata.thumbnailLink,
          webViewLink: metadata.webViewLink,
          webContentLink: metadata.webContentLink,
          iconLink: metadata.iconLink,
        });

        console.log(`[MessageService] Attached file ${fileId} to message`);
      } catch (error: any) {
        console.error(`[MessageService] Failed to process attachment ${fileId}:`, error.message);
        // Continue with other attachments even if one fails
      }
    }
  }

  // Create message with mentions and attachments
  const message = await prisma.message.create({
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

  // Log mention extraction for audit
  if (validMentions.length > 0) {
    logMentionExtraction(message.id, senderId, validMentions);
  }

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

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
  // Get message
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

  // Validate: Only sender can edit
  if (message.senderId !== userId) {
    throw new Error('You can only edit your own messages');
  }

  // Validate: Cannot edit deleted messages
  if (message.isDeleted) {
    throw new Error('Cannot edit deleted messages');
  }

  // Validate: Can only edit within 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (message.createdAt < twentyFourHoursAgo) {
    throw new Error('Messages can only be edited within 24 hours');
  }

  // Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: newContent.trim(),
      isEdited: true,
      updatedAt: new Date(),
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
  // Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // Validate: Cannot delete already deleted message
  if (message.isDeleted) {
    throw new Error('Message already deleted');
  }

  // Check if user is sender or admin
  const isSender = message.senderId === userId;
  const isAdmin = await isAdminOfConversation(message.conversationId, userId);

  if (!isSender && !isAdmin) {
    throw new Error('You can only delete your own messages or be a group admin');
  }

  // Soft delete message
  const deletedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      isDeleted: true,
    },
  });

  console.log(
    `[Audit] User ${userId} deleted message ${messageId} (${isSender ? 'own' : 'as admin'})`
  );

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

/**
 * Add reaction to message
 */
export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ id: string; reactions: any; conversationId: string }> {
  // 1. Get message and verify it exists
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Verify user is member of conversation
  const isMember = await isMemberOfConversation(message.conversationId, userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Cannot react to deleted messages
  if (message.isDeleted) {
    throw new Error('Cannot react to deleted messages');
  }

  // 4. Get current reactions or initialize empty object
  const reactions = (message.reactions as Record<string, string[]>) || {};

  // 5. Add user to emoji reactions if not already present
  if (!reactions[emoji]) {
    reactions[emoji] = [];
  }

  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
  }

  // 6. Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions },
  });

  console.log(`[Audit] User ${userId} reacted ${emoji} to message ${messageId}`);

  return {
    id: updatedMessage.id,
    reactions: updatedMessage.reactions,
    conversationId: updatedMessage.conversationId,
  };
}

/**
 * Remove reaction from message
 */
export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ id: string; reactions: any; conversationId: string }> {
  // 1. Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Verify user is member of conversation
  const isMember = await isMemberOfConversation(message.conversationId, userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Get current reactions
  const reactions = (message.reactions as Record<string, string[]>) || {};

  // 4. Remove user from emoji reactions
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId);

    // 5. Remove emoji key if no users left
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  }

  // 6. Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions },
  });

  console.log(`[Audit] User ${userId} removed ${emoji} reaction from message ${messageId}`);

  return {
    id: updatedMessage.id,
    reactions: updatedMessage.reactions,
    conversationId: updatedMessage.conversationId,
  };
}
