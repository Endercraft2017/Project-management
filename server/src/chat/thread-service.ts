/**
 * Thread Service
 * Business logic for threaded conversations
 */

import prisma from '@/database/client';
import { isMemberOfConversation, isAdminOfConversation } from './conversation-service';
import { extractMentions, validateMentions, logMentionExtraction } from '@/lib/mentions';
import { getFileMetadata, shareFileWithUsers } from '@/services/drive-service';

/**
 * Send a reply in a thread
 */
export async function sendThreadReply(
  parentMessageId: string,
  senderId: string,
  content: string,
  driveFileIds?: string[]
) {
  // 1. Get parent message
  const parentMessage = await prisma.message.findUnique({
    where: { id: parentMessageId },
  });

  if (!parentMessage) {
    throw new Error('Parent message not found');
  }

  // 2. Prevent replies to replies (1-level threading only)
  if (parentMessage.parentMessageId) {
    throw new Error('Cannot reply to a thread reply. Replies must be to main messages only.');
  }

  // 3. Get conversation with members for file sharing
  const conversation = await prisma.conversation.findUnique({
    where: { id: parentMessage.conversationId },
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

  // 4. Verify user is conversation member
  const isMember = await isMemberOfConversation(
    parentMessage.conversationId,
    senderId
  );

  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 5. Cannot reply to deleted messages
  if (parentMessage.isDeleted) {
    throw new Error('Cannot reply to deleted messages');
  }

  // 6. Extract and validate mentions
  const mentionIds = extractMentions(content);
  const validMentions = await validateMentions(mentionIds, parentMessage.conversationId);

  // 7. Process Drive attachments if provided
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

        console.log(`[ThreadService] Attached file ${fileId} to thread reply`);
      } catch (error: any) {
        console.error(`[ThreadService] Failed to process attachment ${fileId}:`, error.message);
        // Continue with other attachments even if one fails
      }
    }
  }

  // 8. Create reply in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create thread reply with mentions and attachments
    const reply = await tx.message.create({
      data: {
        conversationId: parentMessage.conversationId,
        senderId,
        content: content.trim(),
        parentMessageId,
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

    // Increment parent's reply count
    await tx.message.update({
      where: { id: parentMessageId },
      data: {
        threadRepliesCount: {
          increment: 1,
        },
      },
    });

    return reply;
  });

  // Log mention extraction for audit
  if (validMentions.length > 0) {
    logMentionExtraction(result.id, senderId, validMentions);
  }

  console.log(`[Audit] User ${senderId} replied to thread ${parentMessageId}${driveFileIds && driveFileIds.length > 0 ? ` with ${driveFileIds.length} attachment(s)` : ''}`);

  return {
    id: result.id,
    conversationId: result.conversationId,
    senderId: result.senderId,
    sender: {
      id: result.sender.id,
      name: result.sender.name,
      picture: result.sender.picture,
    },
    content: result.content,
    mentions: result.mentions,
    attachments: result.driveAttachments,
    parentMessageId: result.parentMessageId,
    reactions: result.reactions,
    threadRepliesCount: 0, // New reply doesn't have any replies yet
    isEdited: result.isEdited,
    isDeleted: result.isDeleted,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Get thread replies for a message
 */
export async function getThreadReplies(
  parentMessageId: string,
  userId: string,
  limit: number = 50,
  cursor?: string
) {
  // 1. Get parent message to verify conversation
  const parentMessage = await prisma.message.findUnique({
    where: { id: parentMessageId },
  });

  if (!parentMessage) {
    throw new Error('Parent message not found');
  }

  // 2. Verify user is conversation member
  const isMember = await isMemberOfConversation(
    parentMessage.conversationId,
    userId
  );

  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Get thread replies with pagination
  const replies = await prisma.message.findMany({
    where: {
      parentMessageId,
      ...(cursor ? { id: { lt: cursor } } : {}),
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
      createdAt: 'asc', // Chronological order for threads
    },
    take: limit,
  });

  return {
    replies: replies.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      sender: {
        id: r.sender.id,
        name: r.sender.name,
        picture: r.sender.picture,
      },
      content: r.isDeleted ? '[deleted]' : r.content,
      parentMessageId: r.parentMessageId,
      reactions: r.reactions,
      threadRepliesCount: r.threadRepliesCount,
      isEdited: r.isEdited,
      isDeleted: r.isDeleted,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    hasMore: replies.length === limit,
  };
}

/**
 * Delete thread reply
 */
export async function deleteThreadReply(replyId: string, userId: string) {
  const reply = await prisma.message.findUnique({
    where: { id: replyId },
  });

  if (!reply || !reply.parentMessageId) {
    throw new Error('Thread reply not found');
  }

  if (reply.isDeleted) {
    throw new Error('Reply already deleted');
  }

  // Permission check (sender or admin)
  const isSender = reply.senderId === userId;
  const isAdmin = await isAdminOfConversation(reply.conversationId, userId);

  if (!isSender && !isAdmin) {
    throw new Error('You can only delete your own replies or be a group admin');
  }

  // Soft delete in transaction
  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: replyId },
      data: { isDeleted: true },
    });

    // Decrement parent's reply count
    await tx.message.update({
      where: { id: reply.parentMessageId! },
      data: {
        threadRepliesCount: {
          decrement: 1,
        },
      },
    });
  });

  console.log(`[Audit] User ${userId} deleted thread reply ${replyId}`);

  return { id: replyId, conversationId: reply.conversationId, isDeleted: true };
}
