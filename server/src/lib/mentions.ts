/**
 * Mention Utilities
 * Parse, validate, and format @mentions in messages
 */

import prisma from '@/database/client';

/**
 * Regex pattern for mentions: @[userId](userName)
 * Example: @[550e8400-e29b-41d4-a716-446655440000](John Doe)
 */
const MENTION_PATTERN = /@\[([a-f0-9-]{36})\]\(([^)]+)\)/g;

/**
 * Extract user IDs from mention pattern in content
 * @param content - Message content with mentions
 * @returns Array of unique user IDs
 */
export function extractMentions(content: string): string[] {
  const mentions: string[] = [];
  const matches = content.matchAll(MENTION_PATTERN);

  for (const match of matches) {
    const userId = match[1];
    if (!mentions.includes(userId)) {
      mentions.push(userId);
    }
  }

  return mentions;
}

/**
 * Validate that mentioned users are members of the conversation
 * @param mentions - Array of user IDs from content
 * @param conversationId - Conversation ID
 * @returns Array of validated user IDs (only members)
 */
export async function validateMentions(
  mentions: string[],
  conversationId: string
): Promise<string[]> {
  if (mentions.length === 0) {
    return [];
  }

  // Get conversation members
  const members = await prisma.conversationMember.findMany({
    where: {
      conversationId,
      userId: {
        in: mentions,
      },
    },
    select: {
      userId: true,
    },
  });

  return members.map((m) => m.userId);
}

/**
 * Format mention for display
 * Converts @[userId](userName) to @userName
 * @param content - Message content with storage format
 * @returns Content formatted for display
 */
export function formatMentionForDisplay(content: string): string {
  return content.replace(MENTION_PATTERN, '@$2');
}

/**
 * Check if a user is mentioned in a message
 * @param mentions - Array of mentioned user IDs
 * @param userId - User ID to check
 * @returns True if user is mentioned
 */
export function isUserMentioned(mentions: string[], userId: string): boolean {
  return mentions.includes(userId);
}

/**
 * Get mention pattern regex (for client-side use if needed)
 */
export function getMentionPattern(): RegExp {
  return MENTION_PATTERN;
}

/**
 * Audit log mention extraction
 */
export function logMentionExtraction(
  messageId: string,
  senderId: string,
  mentions: string[]
): void {
  if (mentions.length > 0) {
    console.log(
      `[Audit] Message ${messageId} by ${senderId} mentions: ${mentions.join(', ')}`
    );
  }
}
