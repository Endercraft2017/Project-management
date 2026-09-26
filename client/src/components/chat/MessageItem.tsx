/**
 * Message Item Component
 */

import { useState } from 'react';
import { Edit, Trash2, MessageSquare } from 'lucide-react';
import { type Message } from '@/hooks/useMessages';
import { useCurrentUser } from '@/hooks/useUsers';
import { emit } from '@/lib/socket';
import { formatDate } from '@/lib/utils';
import ReactionPicker from './ReactionPicker';
import MessageReactions from './MessageReactions';
import ThreadPreview from './ThreadPreview';
import MentionHighlight from './MentionHighlight';
import { FileAttachment } from './attachments/FileAttachment';
import TaskDetailModal from '../tasks/TaskDetailModal';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  onOpenThread?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  highlight?: boolean;
}

export default function MessageItem({ message, isOwn, onOpenThread, onEdit, highlight = false }: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: currentUser } = useCurrentUser();

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      emit('delete_message', { messageId: message.id });
    }
  };

  const handleAddReaction = (emoji: string) => {
    emit('add_reaction', { messageId: message.id, emoji });
  };

  const handleReactionToggle = (emoji: string) => {
    const hasReacted = message.reactions?.[emoji]?.includes(currentUser?.id || '');

    if (hasReacted) {
      emit('remove_reaction', { messageId: message.id, emoji });
    } else {
      emit('add_reaction', { messageId: message.id, emoji });
    }
  };

  if (message.isDeleted) {
    return (
      <div className={`mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-md rounded-lg bg-muted p-3 text-sm italic text-muted-foreground">
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`group relative mb-4 flex ${isOwn ? 'justify-end' : 'justify-start'} ${highlight ? 'message-highlight' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && message.sender && (
          <div className="mb-1 flex items-center gap-2">
            {message.sender.picture && (
              <img
                src={message.sender.picture}
                alt={message.sender.name}
                className="h-6 w-6 rounded-full"
              />
            )}
            <span className="text-sm font-medium">{message.sender.name}</span>
          </div>
        )}
        {/* Message bubble - only show if there's content */}
        {message.content && (
          <div
            className={`rounded-lg p-3 ${
              isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            <div>
              <MentionHighlight
                content={message.content}
                mentions={message.mentions}
                onTaskClick={handleTaskClick}
              />
              {message.isEdited && (
                <span className="ml-2 text-xs opacity-60 italic">(edited)</span>
              )}
            </div>
          </div>
        )}

        {/* File Attachments */}
        {message.driveAttachments && message.driveAttachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.driveAttachments.map((attachment) => (
              <FileAttachment key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Hover Actions Toolbar */}
        {showActions && !message.isDeleted && (
          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-3 flex gap-1 rounded-lg border border-border bg-background shadow-md p-1`}>
            <ReactionPicker onEmojiSelect={handleAddReaction} />
            {/* Reply in Thread Button - Only show for main messages (not replies) */}
            {!message.parentMessageId && onOpenThread && (
              <button
                onClick={() => onOpenThread(message)}
                title="Reply in thread"
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => onEdit?.(message)}
                  title="Edit"
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDelete}
                  title="Delete"
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Display Reactions */}
        <MessageReactions
          reactions={message.reactions}
          onReactionToggle={handleReactionToggle}
        />

        {/* Thread Preview - Only show for main messages (not replies) */}
        {!message.parentMessageId && onOpenThread && (
          <ThreadPreview
            threadRepliesCount={message.threadRepliesCount}
            onClick={() => onOpenThread(message)}
          />
        )}

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(message.createdAt)}</span>
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
