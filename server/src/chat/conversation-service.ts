/**
 * Conversation Service
 * Business logic for conversation management
 */

import prisma from '@/database/client';
import { Prisma } from '@prisma/client';

/**
 * List conversations for a user
 */
export async function listConversations(
  userId: string,
  filters: { type?: 'DM' | 'GROUP' },
  pagination: { page: number; limit: number }
) {
  const { type } = filters;
  const { page, limit } = pagination;

  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ConversationWhereInput = {
    members: {
      some: {
        userId,
      },
    },
    ...(type && { type }),
  };

  // Get conversations with last message and member info
  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                picture: true,
                isActive: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          where: { isDeleted: false },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  // Calculate unread count for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conversation) => {
      const member = conversation.members.find((m) => m.userId === userId);
      const lastReadAt = member?.lastReadAt || new Date(0);

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          createdAt: { gt: lastReadAt },
          senderId: { not: userId },
          isDeleted: false,
        },
      });

      return {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        members: conversation.members.map((m) => ({
          user: {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            picture: m.user.picture,
            isActive: m.user.isActive,
          },
          isAdmin: m.isAdmin,
        })),
        lastMessage: conversation.messages[0]
          ? {
              id: conversation.messages[0].id,
              content: conversation.messages[0].content,
              senderId: conversation.messages[0].senderId,
              senderName: conversation.messages[0].sender.name,
              createdAt: conversation.messages[0].createdAt,
            }
          : null,
        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    })
  );

  return {
    conversations: conversationsWithUnread,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get conversation by ID
 */
export async function getConversationById(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Check if user is a member
  const isMember = conversation.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    members: conversation.members.map((m) => ({
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        picture: m.user.picture,
      },
      isAdmin: m.isAdmin,
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Create a DM conversation
 */
export async function createDmConversation(userId1: string, userId2: string) {
  // Validate: Cannot DM self
  if (userId1 === userId2) {
    throw new Error('Cannot create DM with yourself');
  }

  // Check if both users exist
  const users = await prisma.user.findMany({
    where: {
      id: { in: [userId1, userId2] },
      isActive: true,
    },
  });

  if (users.length !== 2) {
    throw new Error('One or both users not found or inactive');
  }

  // Check if DM already exists
  const existingDm = await prisma.conversation.findFirst({
    where: {
      type: 'DM',
      AND: [
        { members: { some: { userId: userId1 } } },
        { members: { some: { userId: userId2 } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (existingDm) {
    return {
      id: existingDm.id,
      type: existingDm.type,
      name: existingDm.name,
      members: existingDm.members.map((m) => ({
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          picture: m.user.picture,
        },
        isAdmin: m.isAdmin,
      })),
      createdAt: existingDm.createdAt,
      updatedAt: existingDm.updatedAt,
    };
  }

  // Create new DM conversation
  const conversation = await prisma.conversation.create({
    data: {
      type: 'DM',
      createdById: userId1,
      members: {
        create: [
          { userId: userId1, isAdmin: false },
          { userId: userId2, isAdmin: false },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  console.log(
    `[Audit] User ${userId1} created DM conversation ${conversation.id} with user ${userId2}`
  );

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    members: conversation.members.map((m) => ({
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        picture: m.user.picture,
      },
      isAdmin: m.isAdmin,
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Create a group conversation
 */
export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[]
) {
  // Validate: Group must have 2-50 members (including creator)
  const allMemberIds = [...new Set([creatorId, ...memberIds])];

  if (allMemberIds.length < 2) {
    throw new Error('Group must have at least 2 members');
  }

  if (allMemberIds.length > 50) {
    throw new Error('Group cannot have more than 50 members');
  }

  // Check if all users exist and are active
  const users = await prisma.user.findMany({
    where: {
      id: { in: allMemberIds },
      isActive: true,
    },
  });

  if (users.length !== allMemberIds.length) {
    throw new Error('One or more users not found or inactive');
  }

  // Create group conversation
  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name,
      createdById: creatorId,
      members: {
        create: allMemberIds.map((id) => ({
          userId: id,
          isAdmin: id === creatorId,
        })),
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  console.log(
    `[Audit] User ${creatorId} created group conversation ${conversation.id} with ${allMemberIds.length} members`
  );

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    members: conversation.members.map((m) => ({
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        picture: m.user.picture,
      },
      isAdmin: m.isAdmin,
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Get conversation messages with pagination
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit: number = 50
) {
  // Verify user is a member
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
    },
  });

  if (!member) {
    throw new Error('Not a member of this conversation');
  }

  // Build query (exclude thread replies - only show top-level messages)
  const where: Prisma.MessageWhereInput = {
    conversationId,
    parentMessageId: null, // Only top-level messages, not thread replies
    ...(cursor && { id: { lt: cursor } }),
  };

  // Get messages
  const messages = await prisma.message.findMany({
    where,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          picture: true,
        },
      },
      driveAttachments: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Get one extra to check if there are more
  });

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: resultMessages.map((m) => ({
      id: m.id,
      content: m.isDeleted ? '[deleted]' : m.content,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatarUrl: m.sender.picture,
      isEdited: m.isEdited,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      driveAttachments: m.driveAttachments.map((a) => ({
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
    })),
    hasMore,
    nextCursor: hasMore ? resultMessages[resultMessages.length - 1].id : null,
  };
}

/**
 * Search messages in conversation (includes thread replies)
 */
export async function searchConversationMessages(
  conversationId: string,
  userId: string,
  query: string
) {
  // Verify user is a member
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
    },
  });

  if (!member) {
    throw new Error('Not a member of this conversation');
  }

  // Search for messages containing the query (case-insensitive)
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
      content: {
        contains: query,
        mode: 'insensitive',
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
      // Include parent message info if this is a thread reply
      parentMessage: {
        select: {
          id: true,
          content: true,
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit results
  });

  return {
    results: messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      sender: {
        id: m.sender.id,
        name: m.sender.name,
        picture: m.sender.picture,
      },
      createdAt: m.createdAt,
      isThreadReply: !!m.parentMessageId,
      parentMessage: m.parentMessage
        ? {
            id: m.parentMessage.id,
            content: m.parentMessage.content,
            senderName: m.parentMessage.sender.name,
          }
        : undefined,
    })),
    total: messages.length,
  };
}

/**
 * Add member to group conversation
 */
export async function addMember(
  conversationId: string,
  userIdToAdd: string,
  addedBy: string
) {
  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Validate: Only groups can add members
  if (conversation.type !== 'GROUP') {
    throw new Error('Cannot add members to DM conversations');
  }

  // Validate: User adding must be an admin
  const adderMember = conversation.members.find((m) => m.userId === addedBy);
  if (!adderMember || !adderMember.isAdmin) {
    throw new Error('Only group admins can add members');
  }

  // Validate: User to add exists and is active
  const userToAdd = await prisma.user.findUnique({
    where: { id: userIdToAdd },
  });

  if (!userToAdd || !userToAdd.isActive) {
    throw new Error('User not found or inactive');
  }

  // Validate: User not already a member
  const existingMember = conversation.members.find((m) => m.userId === userIdToAdd);
  if (existingMember) {
    throw new Error('User is already a member');
  }

  // Validate: Group limit (50 members)
  if (conversation.members.length >= 50) {
    throw new Error('Group has reached maximum capacity (50 members)');
  }

  // Add member
  const newMember = await prisma.conversationMember.create({
    data: {
      conversationId,
      userId: userIdToAdd,
      isAdmin: false,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          picture: true,
        },
      },
    },
  });

  console.log(
    `[Audit] User ${addedBy} added user ${userIdToAdd} to conversation ${conversationId}`
  );

  return {
    id: newMember.id,
    userId: newMember.userId,
    userName: newMember.user.name,
    isAdmin: newMember.isAdmin,
    joinedAt: newMember.joinedAt,
  };
}

/**
 * Remove member from group conversation
 */
export async function removeMember(
  conversationId: string,
  userIdToRemove: string,
  removedBy: string
) {
  // Get conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Validate: Only groups can remove members
  if (conversation.type !== 'GROUP') {
    throw new Error('Cannot remove members from DM conversations');
  }

  // Get remover and removee members
  const removerMember = conversation.members.find((m) => m.userId === removedBy);
  const removeeMember = conversation.members.find((m) => m.userId === userIdToRemove);

  if (!removerMember) {
    throw new Error('You are not a member of this conversation');
  }

  if (!removeeMember) {
    throw new Error('User is not a member of this conversation');
  }

  // Authorization: Admin can remove anyone, member can only remove self
  const isSelfRemoval = removedBy === userIdToRemove;
  const isAdminRemoval = removerMember.isAdmin;

  if (!isSelfRemoval && !isAdminRemoval) {
    throw new Error('Only group admins can remove other members');
  }

  // Validate: Cannot remove last admin
  const adminCount = conversation.members.filter((m) => m.isAdmin).length;
  if (removeeMember.isAdmin && adminCount === 1) {
    throw new Error('Cannot remove the last admin. Promote another member first.');
  }

  // Remove member
  await prisma.conversationMember.delete({
    where: {
      id: removeeMember.id,
    },
  });

  console.log(
    `[Audit] User ${removedBy} removed user ${userIdToRemove} from conversation ${conversationId}`
  );

  return {
    success: true,
    message: isSelfRemoval ? 'Left group successfully' : 'Member removed successfully',
  };
}

/**
 * Update last read timestamp for a user in a conversation
 */
export async function updateLastReadAt(conversationId: string, userId: string) {
  await prisma.conversationMember.updateMany({
    where: {
      conversationId,
      userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });
}

/**
 * Check if user is a member of a conversation
 */
export async function isMemberOfConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
    },
  });

  return !!member;
}

/**
 * Check if user is an admin of a conversation
 */
export async function isAdminOfConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
      isAdmin: true,
    },
  });

  return !!member;
}

/**
 * Get all members of a conversation (for mentions autocomplete)
 */
export async function getConversationMembers(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return conversation.members.map((m) => m.user);
}
