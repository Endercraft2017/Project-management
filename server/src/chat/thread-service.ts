/**
 * Thread Service
 * Business logic for threaded conversations
 */

import prisma from '@/database/client';
import { lockMessage, lockConversationMember } from './transaction-policy';
import { isMemberOfConversation, isAdminOfConversation } from './conversation-service';
import { extractMentions, validateMentions, logMentionExtraction } from '@/lib/mentions';

/**
 * Send a reply in a thread
 */
export async function sendThreadReply(
  parentMessageId: string,
  senderId: string,
  content: string,
  driveFileIds?: string[]
) {
  if (driveFileIds?.length) throw Object.assign(new Error('Google Drive attachments are disabled'), { status: 503 });

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

  const attachmentRecords: any[] = [];

  // 8. Create reply in transaction
  const result = await prisma.$transaction(async (tx) => {
    const currentParent = await lockMessage(tx, parentMessageId);
    if (!currentParent || currentParent.conversationId !== parentMessage.conversationId) throw new Error('Parent message not found');
    if (currentParent.parentMessageId) throw new Error('Cannot reply to a thread reply. Replies must be to main messages only.');
    await lockConversationMember(tx, currentParent.conversationId, senderId);
    if (currentParent.isDeleted) throw new Error('Cannot reply to deleted messages');
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
  return prisma.$transaction(async (tx) => {
    // Parent-first lock order is shared with reply creation, avoiding inverse row locks.
    const candidate = await tx.message.findUnique({ where: { id: replyId }, select: { parentMessageId: true } });
    if (!candidate?.parentMessageId) throw new Error('Thread reply not found');
    const parent = await lockMessage(tx, candidate.parentMessageId);
    const reply = await lockMessage(tx, replyId);
    if (!parent || !reply || reply.parentMessageId !== parent.id || reply.conversationId !== parent.conversationId) throw new Error('Thread reply not found');
    const member = await lockConversationMember(tx, reply.conversationId, userId);
    if (reply.senderId !== userId && !member.isAdmin) throw new Error('You can only delete your own replies or be a group admin');
    if (reply.isDeleted) throw new Error('Reply already deleted');
    await tx.message.update({ where: { id: replyId }, data: { isDeleted: true } });
    // Count under the parent lock, repairing historical drift and preventing negative counts.
    const remaining = await tx.message.count({ where: { parentMessageId: parent.id, isDeleted: false } });
    await tx.message.update({ where: { id: parent.id }, data: { threadRepliesCount: remaining } });
    return { id: replyId, conversationId: reply.conversationId, isDeleted: true };
  });
}
