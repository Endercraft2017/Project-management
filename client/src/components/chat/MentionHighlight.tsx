/**
 * MentionHighlight Component
 * Parse and display message content with styled mentions and task mentions
 */

import { useCurrentUser } from '@/hooks/useUsers';

interface MentionHighlightProps {
  content: string;
  mentions?: string[];
  onTaskClick?: (taskId: string) => void;
}

// Regex pattern to match: @[userId](userName)
const MENTION_PATTERN = /@\[([a-f0-9-]{36})\]\(([^)]+)\)/g;
// Regex pattern to match: $[taskId](taskName)
const TASK_MENTION_PATTERN = /\$\[([a-f0-9-]{36})\]\(([^)]+)\)/g;

export default function MentionHighlight({
  content,
  onTaskClick,
}: MentionHighlightProps) {
  const { data: currentUser } = useCurrentUser();

  // Parse content and replace mentions with styled spans
  const parseContent = () => {
    // Find all mentions and task mentions with their positions
    const items: Array<{
      index: number;
      length: number;
      type: 'user' | 'task';
      id: string;
      name: string;
    }> = [];

    // Find all user mentions
    let match;
    const userRegex = new RegExp(MENTION_PATTERN);
    while ((match = userRegex.exec(content)) !== null) {
      items.push({
        index: match.index,
        length: match[0].length,
        type: 'user',
        id: match[1],
        name: match[2],
      });
    }

    // Find all task mentions
    const taskRegex = new RegExp(TASK_MENTION_PATTERN);
    while ((match = taskRegex.exec(content)) !== null) {
      items.push({
        index: match.index,
        length: match[0].length,
        type: 'task',
        id: match[1],
        name: match[2],
      });
    }

    // Sort by index to process in order
    items.sort((a, b) => a.index - b.index);

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    items.forEach((item, idx) => {
      // Add text before this item
      if (item.index > lastIndex) {
        parts.push(content.substring(lastIndex, item.index));
      }

      if (item.type === 'user') {
        // Check if this is the current user
        const isCurrentUser = item.id === currentUser?.id;

        // Add styled user mention
        parts.push(
          <span
            key={`user-${idx}`}
            className={`mention ${isCurrentUser ? 'mention-you' : ''}`}
            title={isCurrentUser ? 'You were mentioned' : `@${item.name}`}
          >
            @{item.name}
          </span>
        );
      } else {
        // Add styled task mention (clickable)
        parts.push(
          <span
            key={`task-${idx}`}
            className="task-mention-chip"
            onClick={() => onTaskClick?.(item.id)}
            title={`Click to view task: ${item.name}`}
          >
            ${item.name}
          </span>
        );
      }

      lastIndex = item.index + item.length;
    });

    // Add remaining text after last item
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return <span className="whitespace-pre-wrap break-words">{parseContent()}</span>;
}
