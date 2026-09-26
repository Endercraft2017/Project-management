/**
 * ThreadSidebar Component - Slack-style thread view
 * Shows parent message and thread replies in a sliding sidebar
 */

import { useEffect, useState, useRef } from 'react';
import { X, Send, MessageSquare, Pencil, Trash2, Check, Paperclip, Edit } from 'lucide-react';
import type { Message } from '@/hooks/useMessages';
import { getSocket } from '@/lib/socket';
import { formatDate } from '@/lib/utils';
import MessageReactions from './MessageReactions';
import ReactionPicker from './ReactionPicker';
import { useCurrentUser } from '@/hooks/useUsers';
import MentionInputV2 from './MentionInputV2';
import MentionHighlight from './MentionHighlight';
import { FileAttachment } from './attachments/FileAttachment';
import { useGooglePicker, type DriveFile } from '@/hooks/useGooglePicker';
import DriveReauthPrompt from '@/components/auth/DriveReauthPrompt';
import TaskDetailModal from '../tasks/TaskDetailModal';

interface ThreadSidebarProps {
  parentMessage: Message;
  onClose: () => void;
}

export default function ThreadSidebar({
  parentMessage,
  onClose,
}: ThreadSidebarProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [hoveredReplyId, setHoveredReplyId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useCurrentUser();
  const { openPicker, isLoaded, error: pickerError, requiresReauth, handleReauth, dismissReauth, retryLoad } = useGooglePicker();

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  // Fetch thread replies when sidebar opens or parent message changes
  useEffect(() => {
    // CRITICAL: Clear replies immediately when parent message changes
    // This prevents showing old thread's replies for new parent message
    setReplies([]);
    setIsLoading(true);

    const socket = getSocket();
    socket?.emit(
      'get_thread_replies',
      {
        parentMessageId: parentMessage.id,
        limit: 50,
      },
      (response: any) => {
        if (response.success) {
          setReplies(Array.isArray(response.data.replies) ? response.data.replies : []);
        }
        setIsLoading(false);
      }
    );
  }, [parentMessage.id]);

  // Listen for new thread replies
  useEffect(() => {
    const handleThreadReply = (data: {
      reply: Message;
      parentMessageId: string;
    }) => {
      if (data.parentMessageId === parentMessage.id) {
        setReplies((prev) => [...prev, data.reply]);
        scrollToBottom();
      }
    };

    const handleReactionChange = (data: { messageId: string; reactions: any }) => {
      // Update reactions for parent message
      if (data.messageId === parentMessage.id) {
        // Parent message reaction handled by parent component
        return;
      }

      // Update reactions for replies
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === data.messageId
            ? { ...reply, reactions: data.reactions }
            : reply
        )
      );
    };

    const handleMessageEdited = (data: any) => {
      // Update edited replies
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === data.id
            ? { ...reply, content: data.content, isEdited: true, updatedAt: data.updatedAt }
            : reply
        )
      );
    };

    const handleMessageDeleted = (data: { id: string }) => {
      // Mark reply as deleted
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === data.id
            ? { ...reply, isDeleted: true, content: '' }
            : reply
        )
      );
    };

    const socket = getSocket();
    socket?.on('thread_reply_added', handleThreadReply);
    socket?.on('reaction_added', handleReactionChange);
    socket?.on('reaction_removed', handleReactionChange);
    socket?.on('message_edited', handleMessageEdited);
    socket?.on('message_deleted', handleMessageDeleted);

    // Cleanup: remove listener when component unmounts or parent changes
    return () => {
      socket?.off('thread_reply_added', handleThreadReply);
      socket?.off('reaction_added', handleReactionChange);
      socket?.off('reaction_removed', handleReactionChange);
      socket?.off('message_edited', handleMessageEdited);
      socket?.off('message_deleted', handleMessageDeleted);
    };
  }, [parentMessage.id]);

  // Auto-scroll to bottom when new replies arrive
  const scrollToBottom = () => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send thread reply
  const handleSendReply = () => {
    // If editing a message
    if (editingMessage) {
      if (replyContent.trim()) {
        const socket = getSocket();
        socket?.emit('edit_message', { messageId: editingMessage.id, content: replyContent.trim() });
      }
      setReplyContent('');
      setEditingMessage(null);
      return;
    }

    // Otherwise send new reply
    if ((!replyContent.trim() && selectedFiles.length === 0) || isSending) return;

    setIsSending(true);
    const socket = getSocket();
    socket?.emit(
      'send_thread_reply',
      {
        parentMessageId: parentMessage.id,
        content: replyContent.trim(),
        driveFileIds: selectedFiles.map(f => f.id),
      },
      (response: any) => {
        setIsSending(false);
        if (response.success) {
          setReplyContent('');
          setSelectedFiles([]);
        } else {
          alert(response.error || 'Failed to send reply');
        }
      }
    );
  };

  const handleCancelEdit = () => {
    setReplyContent('');
    setEditingMessage(null);
  };

  const handleAttachClick = () => {
    openPicker((files) => {
      setSelectedFiles((prev) => [...prev, ...files]);
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    const socket = getSocket();
    socket?.emit('add_reaction', { messageId, emoji });
  };

  const handleReactionToggle = (messageId: string, emoji: string) => {
    const message = messageId === parentMessage.id ? parentMessage : replies.find((r) => r.id === messageId);
    const hasReacted = message?.reactions?.[emoji]?.includes(currentUser?.id || '');

    const socket = getSocket();
    if (hasReacted) {
      socket?.emit('remove_reaction', { messageId, emoji });
    } else {
      socket?.emit('add_reaction', { messageId, emoji });
    }
  };

  const handleEditReply = (reply: Message) => {
    setEditingMessage({ id: reply.id, content: reply.content });
    setReplyContent(reply.content);
  };


  const handleDeleteReply = (replyId: string) => {
    if (!confirm('Delete this reply?')) return;

    const socket = getSocket();
    socket?.emit('delete_message', { messageId: replyId });

    // Optimistically update the reply
    setReplies((prev) =>
      prev.map((r) =>
        r.id === replyId ? { ...r, isDeleted: true, content: '' } : r
      )
    );
  };

  return (
    <div className="flex h-full w-96 flex-col min-h-0 border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Thread</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent"
          title="Close thread"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Parent Message */}
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="mb-2 flex items-center gap-2">
          {parentMessage.sender?.picture && (
            <img
              src={parentMessage.sender.picture}
              alt={parentMessage.sender.name}
              className="h-6 w-6 rounded-full"
            />
          )}
          <span className="text-sm font-medium">
            {parentMessage.sender?.name || 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(parentMessage.createdAt)}
          </span>
        </div>
        {parentMessage.content && (
          <div className="whitespace-pre-wrap break-words text-sm">
            <MentionHighlight
              content={parentMessage.content}
              mentions={parentMessage.mentions}
              onTaskClick={handleTaskClick}
            />
          </div>
        )}
        {/* Parent Message Attachments */}
        {parentMessage.driveAttachments && parentMessage.driveAttachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {parentMessage.driveAttachments.map((attachment) => (
              <FileAttachment key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
        <MessageReactions
          reactions={parentMessage.reactions}
          onReactionToggle={(emoji) => handleReactionToggle(parentMessage.id, emoji)}
        />
      </div>

      {/* Thread Replies */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : replies.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="mb-2 h-12 w-12 opacity-20" />
            <p className="text-sm">No replies yet</p>
            <p className="text-xs">Be the first to reply!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => {
              const isOwn = reply.senderId === currentUser?.id;
              return (
                <div
                  key={reply.id}
                  className={`group relative flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  onMouseEnter={() => setHoveredReplyId(reply.id)}
                  onMouseLeave={() => setHoveredReplyId(null)}
                >
                  <div className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isOwn && reply.sender && (
                      <div className="mb-1 flex items-center gap-2">
                        {reply.sender.picture && (
                          <img
                            src={reply.sender.picture}
                            alt={reply.sender.name}
                            className="h-6 w-6 rounded-full"
                          />
                        )}
                        <span className="text-sm font-medium">
                          {reply.sender.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(reply.createdAt)}
                        </span>
                      </div>
                    )}

                    <>
                        <div
                          className={`rounded-lg p-3 ${
                            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}
                        >
                          {reply.isDeleted ? (
                            <div className="whitespace-pre-wrap break-words text-sm">
                              <span className="italic opacity-70">
                                Message deleted
                              </span>
                            </div>
                          ) : (
                            <>
                              {reply.content && (
                                <div className="whitespace-pre-wrap break-words text-sm">
                                  <MentionHighlight
                                    content={reply.content}
                                    mentions={reply.mentions}
                                    onTaskClick={handleTaskClick}
                                  />
                                  {reply.isEdited && (
                                    <span className="ml-1 text-xs opacity-70">(edited)</span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {isOwn && (
                            <span className="mt-1 block text-xs opacity-70">
                              {formatDate(reply.createdAt)}
                            </span>
                          )}
                        </div>
                        {/* Reply Attachments */}
                        {reply.driveAttachments && reply.driveAttachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {reply.driveAttachments.map((attachment) => (
                              <FileAttachment key={attachment.id} attachment={attachment} />
                            ))}
                          </div>
                        )}
                        <MessageReactions
                          reactions={reply.reactions}
                          onReactionToggle={(emoji) => handleReactionToggle(reply.id, emoji)}
                        />
                      </>
                  </div>

                  {/* Hover actions - Edit/Delete + Reaction picker */}
                  {!reply.isDeleted && hoveredReplyId === reply.id && (
                    <div className={`absolute -top-2 ${isOwn ? 'right-0' : 'left-0'} flex gap-1 rounded-lg border border-border bg-background p-1 shadow-md`}>
                      {isOwn && (
                        <>
                          <button
                            onClick={() => handleEditReply(reply)}
                            className="rounded p-1 hover:bg-accent"
                            title="Edit message"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReply(reply.id)}
                            className="rounded p-1 hover:bg-accent text-destructive"
                            title="Delete message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="mx-1 h-full w-px bg-border" />
                        </>
                      )}
                      <ReactionPicker
                        onEmojiSelect={(emoji) => handleAddReaction(reply.id, emoji)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={repliesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t border-border p-4">
        {/* Re-auth Prompt */}
        {requiresReauth && (
          <DriveReauthPrompt
            onReauth={handleReauth}
            onDismiss={dismissReauth}
            variant="inline"
          />
        )}

        {/* Picker Error Display with Retry */}
        {pickerError && !requiresReauth && (
          <div className="mb-2 rounded-md border border-destructive bg-destructive/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-destructive">{pickerError}</span>
              {pickerError.includes('not loaded') && (
                <button
                  onClick={retryLoad}
                  className="ml-3 rounded bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/30"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected Files Display */}
        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5"
              >
                {file.iconUrl && (
                  <img src={file.iconUrl} alt="" className="h-4 w-4" />
                )}
                <span className="text-sm">{file.name}</span>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="ml-1 rounded hover:bg-accent"
                  title="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editing Indicator */}
        {editingMessage && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-primary bg-primary/10 p-2">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Editing message</span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <MentionInputV2
              value={replyContent}
              onChange={setReplyContent}
              onSubmit={handleSendReply}
              conversationId={parentMessage.conversationId}
              placeholder="Reply to thread..."
              disabled={isSending}
            />
          </div>
          <button
            onClick={handleAttachClick}
            disabled={!isLoaded || isSending}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed self-end"
            title="Attach files from Google Drive"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={handleSendReply}
            disabled={(!replyContent.trim() && selectedFiles.length === 0) || isSending}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            title="Send reply"
          >
            {isSending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          viewMode="mention"
        />
      )}
    </div>
  );
}
