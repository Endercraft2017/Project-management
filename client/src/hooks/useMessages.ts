/**
 * TanStack Query Hooks for Messages
 */

import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';

export interface MessageAttachment {
  id: string;
  messageId: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailLink?: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  reactions?: Record<string, string[]>; // emoji -> array of user IDs

  // Threading support
  parentMessageId?: string;
  threadRepliesCount: number;

  // Mentions support
  mentions?: string[]; // Array of mentioned user IDs

  // Attachments support (Google Drive files)
  driveAttachments?: MessageAttachment[];

  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: { id: string; name: string; picture?: string };
}

export const messageKeys = {
  all: ['messages'] as const,
  conversation: (id: string) => [...messageKeys.all, id] as const,
};

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.conversation(conversationId),
    queryFn: ({ pageParam = 1 }) =>
      get<{ messages: Message[]; hasMore: boolean }>(
        `/api/conversations/${conversationId}/messages?page=${pageParam}`
      ),
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    initialPageParam: 1,
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content, driveFileIds }: { conversationId: string; content: string; driveFileIds?: string[] }) =>
      post(`/api/conversations/${conversationId}/messages`, { content, driveFileIds }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(variables.conversationId) });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      patch<Pick<Message, 'conversationId'>>(`/api/messages/${messageId}`, { content }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(data.conversationId) });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => del<Pick<Message, 'conversationId'>>(`/api/messages/${messageId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(data.conversationId) });
    },
  });
}
