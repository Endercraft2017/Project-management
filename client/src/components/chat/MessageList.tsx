/**
 * Message List Component
 */

import { useEffect, useRef } from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMessages, messageKeys } from '@/hooks/useMessages';
import type { Message } from '@/hooks/useMessages';
import { useCurrentUser } from '@/hooks/useUsers';
import { useConversations, conversationKeys } from '@/hooks/useConversations';
import MessageItem from './MessageItem';
import { on, off, joinConversation, leaveConversation } from '@/lib/socket';

interface MessageListProps {
  conversationId: string;
  onOpenThread?: (message: Message) => void;
  onEditMessage?: (message: Message) => void;
  onBack?: () => void;
  highlightMessageId?: string;
}

export default function MessageList({ conversationId, onOpenThread, onEditMessage, onBack, highlightMessageId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: conversations } = useConversations();
  const { data, isLoading, fetchNextPage, hasNextPage, refetch } = useMessages(conversationId);

  // Reverse messages so oldest appears first (newest at bottom)
  const messages = data?.pages.flatMap((page) => page.messages).reverse() || [];
  const conversation = conversations?.find(c => c.id === conversationId);

  // Get conversation display name
  const getConversationName = () => {
    if (!conversation) return '';
    if (conversation.type === 'GROUP') return conversation.name;
    const otherMember = conversation.members.find(m => m.user && m.user.id !== currentUser?.id);
    return otherMember?.user?.name || 'Unknown User';
  };

  useEffect(() => {
    joinConversation(conversationId);

    // Invalidate conversations to update unread count immediately
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

    const handleNewMessage = () => {
      refetch();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleMessageEdited = (data: Pick<Message, 'id' | 'content' | 'updatedAt'>) => {
      console.log('[MessageList] Message edit event received:', data);
      // Optimistically update the cache
      queryClient.setQueryData(
        messageKeys.conversation(conversationId),
        (oldData: InfiniteData<{messages: Message[]; hasMore: boolean}> | undefined) => {
          if (!oldData) {
            console.log('[MessageList] No oldData in cache for edit');
            return oldData;
          }

          console.log('[MessageList] Updating edited message in cache:', data.id);
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.id === data.id
                  ? {
                      ...msg,
                      content: data.content,
                      isEdited: true,
                      updatedAt: data.updatedAt
                    }
                  : msg
              ),
            })),
          };
        }
      );
      console.log('[MessageList] Edit cache updated');
    };

    const handleMessageDeleted = (data: {id: string}) => {
      // Optimistically update the cache
      queryClient.setQueryData(
        messageKeys.conversation(conversationId),
        (oldData: InfiniteData<{messages: Message[]; hasMore: boolean}> | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.id === data.id
                  ? { ...msg, isDeleted: true, content: '' }
                  : msg
              ),
            })),
          };
        }
      );
    };

    const handleReactionChange = (data: {messageId: string; reactions: Record<string, string[]>}) => {
      console.log('[MessageList] Reaction event received:', data);
      // Optimistically update the cache with reaction data
      queryClient.setQueryData(
        messageKeys.conversation(conversationId),
        (oldData: InfiniteData<{messages: Message[]; hasMore: boolean}> | undefined) => {
          if (!oldData) {
            console.log('[MessageList] No oldData in cache for reactions');
            return oldData;
          }

          console.log('[MessageList] Updating reactions in cache for message:', data.messageId);
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.id === data.messageId
                  ? { ...msg, reactions: data.reactions }
                  : msg
              ),
            })),
          };
        }
      );
      console.log('[MessageList] Reaction cache updated');
    };

    const handleThreadReplyAdded = (data: {parentMessageId: string}) => {
      // Update thread reply count
      queryClient.setQueryData(
        messageKeys.conversation(conversationId),
        (oldData: InfiniteData<{messages: Message[]; hasMore: boolean}> | undefined) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg: Message) =>
                msg.id === data.parentMessageId
                  ? { ...msg, threadRepliesCount: (msg.threadRepliesCount || 0) + 1 }
                  : msg
              ),
            })),
          };
        }
      );
    };

    on('new_message', handleNewMessage);
    on('message_edited', handleMessageEdited);
    on('message_deleted', handleMessageDeleted);
    on('reaction_added', handleReactionChange);
    on('reaction_removed', handleReactionChange);
    on('thread_reply_added', handleThreadReplyAdded);

    return () => {
      off('new_message', handleNewMessage);
      off('message_edited', handleMessageEdited);
      off('message_deleted', handleMessageDeleted);
      off('reaction_added', handleReactionChange);
      off('reaction_removed', handleReactionChange);
      off('thread_reply_added', handleThreadReplyAdded);
      leaveConversation(conversationId);
    };
  }, [conversationId, queryClient, refetch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages.length]);

  // Scroll to highlighted message when highlightMessageId changes
  useEffect(() => {
    if (highlightMessageId) {
      const element = document.getElementById(`message-${highlightMessageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightMessageId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Mobile Header with Back Button */}
      {onBack && (
        <div className="md:hidden border-b border-border bg-card p-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-2 hover:bg-accent transition-colors"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold truncate">{getConversationName()}</h2>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {hasNextPage && (
          <button onClick={() => fetchNextPage()} className="mb-4 text-sm text-primary">
            Load more messages
          </button>
        )}
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwn={message.senderId === currentUser?.id}
            onOpenThread={onOpenThread}
            onEdit={onEditMessage}
            highlight={message.id === highlightMessageId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
