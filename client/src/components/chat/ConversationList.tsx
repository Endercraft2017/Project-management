/**
 * Conversation List Component
 */

import { MessageCircle, Plus } from 'lucide-react';
import type { Conversation } from '@/hooks/useConversations';
import { formatDate } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useUsers';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewMessage?: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewMessage,
}: ConversationListProps) {
  const { data: currentUser } = useCurrentUser();
  return (
    <div className="w-full md:w-80 border-r border-border bg-card h-full flex flex-col min-h-0">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <MessageCircle className="h-5 w-5" />
            Messages
          </h2>
          {onNewMessage && (
            <button
              onClick={onNewMessage}
              className="rounded-md p-2 hover:bg-accent transition-colors"
              title="New Message"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {conversations.map((conv) => {
          const otherMember = conv.type === 'DM'
            ? conv.members.find((m) => m.user && m.user.id !== currentUser?.id)
            : null;
          const isInactive = otherMember && !otherMember.user?.isActive;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-accent ${
                selectedId === conv.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {conv.type === 'DM'
                      ? otherMember?.user?.name || 'Unknown User'
                      : conv.name}
                  </span>
                  {isInactive && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>
                {conv.unreadCount && conv.unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span className="truncate">{conv.lastMessage.content}</span>
                  <span className="text-xs">{formatDate(conv.lastMessage.createdAt)}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
