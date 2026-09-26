/**
 * TanStack Query Hook for Conversation Members
 * Used for mentions autocomplete
 */

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type { User } from '@/types';

export const conversationMembersKeys = {
  all: ['conversation-members'] as const,
  conversation: (id: string) => [...conversationMembersKeys.all, id] as const,
};

export function useConversationMembers(conversationId: string) {
  return useQuery({
    queryKey: conversationMembersKeys.conversation(conversationId),
    queryFn: () =>
      get<{ members: User[] }>(`/api/conversations/${conversationId}/members`),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes - members don't change often
  });
}
