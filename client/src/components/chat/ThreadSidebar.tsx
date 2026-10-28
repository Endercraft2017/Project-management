/**
 * ThreadSidebar Component - Slack-style thread view
 * Shows parent message and thread replies in a sliding sidebar
 */

import { useEffect, useState, useRef } from 'react';
import { X, Send, MessageSquare, Pencil, Trash2, Edit } from 'lucide-react';
import type { Message } from '@/hooks/useMessages';
import { getSocket } from '@/lib/socket';
import { formatDate } from '@/lib/utils';
import MessageReactions from './MessageReactions';
import ReactionPicker from './ReactionPicker';
import { useCurrentUser } from '@/hooks/useUsers';
import MentionInputV2 from './MentionInputV2';
import MentionHighlight from './MentionHighlight';
import TaskDetailModal from '../tasks/TaskDetailModal';

interface ThreadResponse {
  success: boolean;
  data?: Message | { replies?: Message[] };
  error?: string;
}
function requestThread(
  event: string,
  data: unknown,
  signal?: AbortSignal,
): Promise<ThreadResponse> {
  const socket = getSocket();
  if (!socket?.connected)
    return Promise.reject(
      new Error(
        'Connection unavailable. Reconnect and try again. Your draft is kept.',
      ),
    );
  return new Promise((resolve, reject) => {
    let complete = false;
    const finish = (error?: Error, response?: ThreadResponse) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      socket.off('disconnect', disconnected);
      signal?.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve(response!);
    };
    const uncertain = () =>
      new Error(
        'No confirmation received. Your draft is kept. Check the thread before retrying to avoid a duplicate.',
      );
    const disconnected = () => finish(uncertain());
    const aborted = () => finish(new Error('Request canceled'));
    const timer = setTimeout(() => finish(uncertain()), 10000);
    socket.on('disconnect', disconnected);
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) return aborted();
    try {
      socket.emit(event, data, (response: ThreadResponse) => {
        if (response?.success === true) finish(undefined, response);
        else
          finish(
            new Error(response?.error || 'Request failed. Your draft is kept.'),
          );
      });
    } catch {
      finish(uncertain());
    }
  });
}

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
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [hoveredReplyId, setHoveredReplyId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const drafts = useRef(new Map<string, string>());
  const activeParent = useRef(parentMessage.id);
  const pending = useRef(false);
  const requestNumber = useRef(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useCurrentUser();

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  useEffect(() => {
    activeParent.current = parentMessage.id;
    requestNumber.current += 1;
    pending.current = false;
    setReplyContent(drafts.current.get(parentMessage.id) || '');
    setEditingMessage(null);
    setIsSending(false);
    setRequestError(null);
    return () => {
      activeParent.current = '';
      requestNumber.current += 1;
    };
  }, [parentMessage.id]);
  const changeDraft = (value: string) => {
    drafts.current.set(parentMessage.id, value);
    setReplyContent(value);
  };

  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    setReplies([]);
    setIsLoading(true);
    setLoadError(null);
    void requestThread(
      'get_thread_replies',
      { parentMessageId: parentMessage.id, limit: 50 },
      controller.signal,
    )
      .then((response) => {
        if (!canceled)
          setReplies(
            Array.isArray((response.data as { replies?: Message[] })?.replies)
              ? (response.data as { replies: Message[] }).replies
              : [],
          );
      })
      .catch((error) => {
        if (!canceled) setLoadError(error.message);
      })
      .finally(() => {
        if (!canceled) setIsLoading(false);
      });
    return () => {
      canceled = true;
      controller.abort();
    };
  }, [parentMessage.id, reload]);

  // Listen for new thread replies
  useEffect(() => {
    const handleThreadReply = (data: {
      reply: Message;
      parentMessageId: string;
    }) => {
      if (data.parentMessageId === parentMessage.id) {
        setReplies((prev) =>
          prev.some((reply) => reply.id === data.reply.id)
            ? prev
            : [...prev, data.reply],
        );
        scrollToBottom();
      }
    };

    const handleReactionChange = (data: {
      messageId: string;
      reactions: Record<string, string[]>;
    }) => {
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
            : reply,
        ),
      );
    };

    const handleMessageEdited = (data: Pick<Message, 'id' | 'content' | 'updatedAt'>) => {
      // Update edited replies
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === data.id
            ? {
                ...reply,
                content: data.content,
                isEdited: true,
                updatedAt: data.updatedAt,
              }
            : reply,
        ),
      );
    };

    const handleMessageDeleted = (data: { id: string }) => {
      // Mark reply as deleted
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === data.id
            ? { ...reply, isDeleted: true, content: '' }
            : reply,
        ),
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

  const handleSendReply = async () => {
    if (!replyContent.trim() || pending.current) return;
    const threadId = parentMessage.id,
      content = replyContent.trim(),
      draft = replyContent;
    const edited = editingMessage;
    const number = ++requestNumber.current;
    pending.current = true;
    setIsSending(true);
    setRequestError(null);
    try {
      const response = await requestThread(
        edited ? 'edit_message' : 'send_thread_reply',
        edited
          ? { messageId: edited.id, content }
          : { parentMessageId: threadId, content },
      );
      if (drafts.current.get(threadId) === draft)
        drafts.current.delete(threadId);
      if (activeParent.current !== threadId || requestNumber.current !== number)
        return;
      const reply = response.data as Message | undefined;
      if (reply?.id)
        setReplies((prev) =>
          edited
            ? prev.map((item) =>
                item.id === reply.id ? { ...item, ...reply } : item,
              )
            : prev.some((item) => item.id === reply.id)
              ? prev
              : [...prev, reply],
        );
      setReplyContent('');
      setEditingMessage(null);
    } catch (error) {
      if (activeParent.current === threadId && requestNumber.current === number)
        setRequestError(
          error instanceof Error
            ? error.message
            : 'Request failed. Your draft is kept.',
        );
    } finally {
      if (
        activeParent.current === threadId &&
        requestNumber.current === number
      ) {
        pending.current = false;
        setIsSending(false);
      }
    }
  };
  const handleCancelEdit = () => {
    if (pending.current) return;
    changeDraft('');
    setEditingMessage(null);
    setRequestError(null);
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    const socket = getSocket();
    socket?.emit('add_reaction', { messageId, emoji });
  };

  const handleReactionToggle = (messageId: string, emoji: string) => {
    const message =
      messageId === parentMessage.id
        ? parentMessage
        : replies.find((r) => r.id === messageId);
    const hasReacted = message?.reactions?.[emoji]?.includes(
      currentUser?.id || '',
    );

    const socket = getSocket();
    if (hasReacted) {
      socket?.emit('remove_reaction', { messageId, emoji });
    } else {
      socket?.emit('add_reaction', { messageId, emoji });
    }
  };

  const handleEditReply = (reply: Message) => {
    if (pending.current) return;
    setEditingMessage({ id: reply.id, content: reply.content });
    changeDraft(reply.content);
  };

  const handleDeleteReply = (replyId: string) => {
    if (!confirm('Delete this reply?')) return;

    const socket = getSocket();
    socket?.emit('delete_message', { messageId: replyId });

    // Optimistically update the reply
    setReplies((prev) =>
      prev.map((r) =>
        r.id === replyId ? { ...r, isDeleted: true, content: '' } : r,
      ),
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
        <MessageReactions
          reactions={parentMessage.reactions}
          onReactionToggle={(emoji) =>
            handleReactionToggle(parentMessage.id, emoji)
          }
        />
      </div>

      {/* Thread Replies */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : loadError ? (
          <div role="alert" className="space-y-3 text-sm text-destructive">
            <p>{loadError}</p>
            <button
              className="underline"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry loading replies
            </button>
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
                  <div
                    className={`max-w-[85%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}
                  >
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
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
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
                                  <span className="ml-1 text-xs opacity-70">
                                    (edited)
                                  </span>
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
                      <MessageReactions
                        reactions={reply.reactions}
                        onReactionToggle={(emoji) =>
                          handleReactionToggle(reply.id, emoji)
                        }
                      />
                    </>
                  </div>

                  {/* Hover actions - Edit/Delete + Reaction picker */}
                  {!reply.isDeleted && hoveredReplyId === reply.id && (
                    <div
                      className={`absolute -top-2 ${isOwn ? 'right-0' : 'left-0'} flex gap-1 rounded-lg border border-border bg-background p-1 shadow-md`}
                    >
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
                        onEmojiSelect={(emoji) =>
                          handleAddReaction(reply.id, emoji)
                        }
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
        {requestError && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {requestError}
          </p>
        )}
        {/* Editing Indicator */}
        {editingMessage && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-primary bg-primary/10 p-2">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Editing message
              </span>
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
              onChange={changeDraft}
              onSubmit={handleSendReply}
              conversationId={parentMessage.conversationId}
              placeholder="Reply to thread..."
              disabled={isSending}
            />
          </div>
          <button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || isSending}
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
