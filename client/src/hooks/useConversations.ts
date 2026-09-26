/**
 * TanStack Query Hooks for Conversations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, get, post, patch, del } from '@/lib/api';

export interface Conversation {
  id: string;
  type: 'DM' | 'GROUP';
  name?: string;
  members: Array<{ user: { id: string; name: string; picture?: string; isActive?: boolean }; isAdmin?: boolean }>;
  lastMessage?: { content: string; createdAt: string };
  unreadCount?: number;
}

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  detail: (id: string) => [...conversationKeys.all, id] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Conversation[] }>('/api/conversations');
      return response.data.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: 'DM' | 'GROUP'; memberIds: string[]; name?: string }) => {
      if (data.type === 'DM') {
        // DM endpoint expects { userId: string }
        return post('/api/conversations/dm', { userId: data.memberIds[0] });
      } else {
        // Group endpoint expects { name: string, memberIds: string[] }
        return post('/api/conversations/group', { name: data.name, memberIds: data.memberIds });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationKeys.lists() }),
  });
}
