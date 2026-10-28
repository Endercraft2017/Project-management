/**
 * Chat View Component - Main chat interface
 */

import { useState, useEffect } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useCurrentUser } from '@/hooks/useUsers';
import { connectSocket, on, off } from '@/lib/socket';
import type { Message } from '@/hooks/useMessages';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import MessageSearch from './MessageSearch';
import ThreadSidebar from './ThreadSidebar';
import NewMessageDialog from './NewMessageDialog';

interface ChatViewProps {
  initialConversationId?: string | null;
  initialHighlightMessageId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
}

export default function ChatView({
  initialConversationId,
  initialHighlightMessageId,
  onConversationChange,
}: ChatViewProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [threadParentMessage, setThreadParentMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const { data: conversations, refetch } = useConversations();
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    connectSocket();

    const handleNewMessage = () => { void refetch(); };
    on('new_message', handleNewMessage);

    // The authenticated app owns the shared connection and global listeners.
    return () => { off('new_message', handleNewMessage); };
  }, [refetch]);

  // Sync with parent component's selected conversation
  useEffect(() => {
    if (initialConversationId) {
      setSelectedConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  // Close thread sidebar when switching conversations
  useEffect(() => {
    setThreadParentMessage(null);
  }, [selectedConversationId]);

  // Notify parent of conversation changes
  useEffect(() => {
    if (onConversationChange) {
      onConversationChange(selectedConversationId);
    }
  }, [selectedConversationId, onConversationChange]);

  const handleOpenThread = (message: Message) => {
    setThreadParentMessage(message);
  };

  const handleCloseThread = () => {
    setThreadParentMessage(null);
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage({ id: message.id, content: message.content });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSearchResultClick = (messageId: string, isThreadReply: boolean, parentMessageId?: string) => {
    if (isThreadReply && parentMessageId) {
      // Find the parent message and open thread
      // For now, we'll need to fetch the parent message
      // This is a simplified approach - in production you'd want to scroll to it or fetch it
      const parentMsg: Message = {
        id: parentMessageId,
        conversationId: selectedConversationId!,
        senderId: '',
        content: '',
        threadRepliesCount: 0,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setThreadParentMessage(parentMsg);
    }
    // TODO: Scroll to message in main view if not a thread reply
  };

  const handleNewConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    refetch();
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
  };

  return (
    <div className="flex h-full">
      {/* Conversation List - Hidden on mobile when chat is selected */}
      <div className={`${selectedConversationId ? 'hidden md:block' : 'block'} w-full md:w-80`}>
        <ConversationList
          conversations={conversations || []}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onNewMessage={() => setNewMessageDialogOpen(true)}
        />
      </div>

      {/* Chat Messages - Hidden on mobile when no chat selected */}
      {selectedConversationId ? (
        <>
          <div className={`flex flex-1 flex-col overflow-hidden ${selectedConversationId ? 'block' : 'hidden md:block'}`}>
            <MessageSearch
              conversationId={selectedConversationId}
              onResultClick={handleSearchResultClick}
            />
            <MessageList
              conversationId={selectedConversationId}
              onOpenThread={handleOpenThread}
              onEditMessage={handleEditMessage}
              onBack={handleBackToList}
              highlightMessageId={initialHighlightMessageId || undefined}
            />
            <MessageInput
              conversationId={selectedConversationId}
              editingMessage={editingMessage}
              onCancelEdit={handleCancelEdit}
            />
          </div>
          {/* Thread Sidebar - Slides in from right */}
          {threadParentMessage && (
            <ThreadSidebar
              parentMessage={threadParentMessage}
              onClose={handleCloseThread}
            />
          )}
        </>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
          Select a conversation to start chatting
        </div>
      )}

      {/* New Message Dialog */}
      {currentUser && (
        <NewMessageDialog
          open={newMessageDialogOpen}
          onOpenChange={setNewMessageDialogOpen}
          currentUserId={currentUser.id}
          onConversationCreated={handleNewConversation}
        />
      )}
    </div>
  );
}
