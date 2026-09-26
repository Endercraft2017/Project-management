/**
 * ThreadPreview Component
 * Shows thread reply count and option to open thread sidebar
 */

import { MessageSquare } from 'lucide-react';

interface ThreadPreviewProps {
  threadRepliesCount: number;
  onClick: () => void;
}

export default function ThreadPreview({
  threadRepliesCount,
  onClick,
}: ThreadPreviewProps) {
  if (threadRepliesCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <MessageSquare className="h-4 w-4" />
      <span>
        {threadRepliesCount} {threadRepliesCount === 1 ? 'reply' : 'replies'}
      </span>
    </button>
  );
}
