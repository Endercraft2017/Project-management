/**
 * Message Reactions Component
 * Displays reactions under messages with toggle functionality
 */

import { useCurrentUser } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

interface MessageReactionsProps {
  reactions?: Record<string, string[]>;
  onReactionToggle: (emoji: string) => void;
}

export default function MessageReactions({
  reactions,
  onReactionToggle,
}: MessageReactionsProps) {
  const { data: currentUser } = useCurrentUser();

  if (!reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(reactions).map(([emoji, userIds]) => {
          const count = userIds.length;
          const hasReacted = currentUser && userIds.includes(currentUser.id);

          return (
            <Tooltip.Root key={emoji}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => onReactionToggle(emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm transition-colors',
                    hasReacted
                      ? 'bg-primary/20 border border-primary text-primary hover:bg-primary/30'
                      : 'bg-muted border border-border hover:bg-accent hover:border-accent-foreground'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-xs font-medium">{count}</span>
                </button>
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md border border-border"
                  sideOffset={5}
                >
                  {count === 1
                    ? hasReacted
                      ? 'You reacted'
                      : '1 person reacted'
                    : hasReacted
                    ? `You and ${count - 1} other${count - 1 === 1 ? '' : 's'} reacted`
                    : `${count} people reacted`}
                  <Tooltip.Arrow className="fill-popover" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
