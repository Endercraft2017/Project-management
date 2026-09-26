# Phase 2: Message Reactions - Detailed Implementation Plan

## Overview
Implement Slack-style message reactions using the existing `reactions` JSON field in the Message model.

## Prerequisites
- Phase 1 (Team Invitations) completed ✅
- Database schema already has `reactions Json?` field ✅
- Socket.IO infrastructure exists ✅
- emoji-picker-react is installed ✅

---

## Data Structure

The `reactions` field stores reactions as JSON:
```typescript
{
  "👍": ["user-id-1", "user-id-2"],
  "❤️": ["user-id-3"],
  "😂": ["user-id-1", "user-id-4"]
}
```

**Key Properties:**
- Key: Unicode emoji string
- Value: Array of user IDs who reacted
- Empty arrays auto-cleanup on remove
- No custom emojis (Unicode only)

---

## Step 2.1: Backend - Message Service Extension

### File: `server/src/chat/message-service.ts`

Add these functions:

```typescript
/**
 * Add reaction to message
 */
export async function addReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ id: string; reactions: any; conversationId: string }> {
  // 1. Get message and verify it exists
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Verify user is member of conversation
  const isMember = await isMemberOfConversation(message.conversationId, userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Cannot react to deleted messages
  if (message.isDeleted) {
    throw new Error('Cannot react to deleted messages');
  }

  // 4. Get current reactions or initialize empty object
  const reactions = (message.reactions as Record<string, string[]>) || {};

  // 5. Add user to emoji reactions if not already present
  if (!reactions[emoji]) {
    reactions[emoji] = [];
  }

  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
  }

  // 6. Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions },
  });

  console.log(`[Audit] User ${userId} reacted ${emoji} to message ${messageId}`);

  return {
    id: updatedMessage.id,
    reactions: updatedMessage.reactions,
    conversationId: updatedMessage.conversationId,
  };
}

/**
 * Remove reaction from message
 */
export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ id: string; reactions: any; conversationId: string }> {
  // 1. Get message
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Verify user is member of conversation
  const isMember = await isMemberOfConversation(message.conversationId, userId);
  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Get current reactions
  const reactions = (message.reactions as Record<string, string[]>) || {};

  // 4. Remove user from emoji reactions
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id) => id !== userId);

    // 5. Remove emoji key if no users left
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  }

  // 6. Update message
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { reactions },
  });

  console.log(`[Audit] User ${userId} removed ${emoji} reaction from message ${messageId}`);

  return {
    id: updatedMessage.id,
    reactions: updatedMessage.reactions,
    conversationId: updatedMessage.conversationId,
  };
}
```

---

## Step 2.2: Backend - Validators

### File: `server/src/chat/validators.ts`

Add reaction validation schemas:

```typescript
export const reactionSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  emoji: z
    .string()
    .min(1, 'Emoji is required')
    .max(10, 'Invalid emoji')
    .regex(
      /^[\p{Emoji}\u200d]+$/u,
      'Only Unicode emojis are allowed'
    ),
});
```

---

## Step 2.3: Backend - Socket Handlers

### File: `server/src/chat/socket-handlers.ts`

Add these event handlers in `registerSocketHandlers`:

```typescript
/**
 * Event: add_reaction
 * User adds reaction to a message
 */
socket.on('add_reaction', async (data, callback) => {
  try {
    // Validate input
    const parsed = reactionSchema.parse(data);
    const { messageId, emoji } = parsed;

    // Add reaction via service
    const result = await messageService.addReaction(messageId, userId, emoji);

    console.log(`[Socket.IO] Reaction ${emoji} added by ${userName} to message ${messageId}`);

    // Send acknowledgment
    if (callback) callback({ success: true, data: result });

    // Broadcast to all in room
    io.to(`conversation:${result.conversationId}`).emit('reaction_added', {
      messageId: result.id,
      reactions: result.reactions,
      userId,
      emoji,
    });
  } catch (error: any) {
    console.error('[Socket.IO] Error in add_reaction:', error.message);
    if (callback) callback({ success: false, error: error.message });
  }
});

/**
 * Event: remove_reaction
 * User removes their reaction from a message
 */
socket.on('remove_reaction', async (data, callback) => {
  try {
    // Validate input
    const parsed = reactionSchema.parse(data);
    const { messageId, emoji } = parsed;

    // Remove reaction via service
    const result = await messageService.removeReaction(messageId, userId, emoji);

    console.log(`[Socket.IO] Reaction ${emoji} removed by ${userName} from message ${messageId}`);

    // Send acknowledgment
    if (callback) callback({ success: true, data: result });

    // Broadcast to all in room
    io.to(`conversation:${result.conversationId}`).emit('reaction_removed', {
      messageId: result.id,
      reactions: result.reactions,
      userId,
      emoji,
    });
  } catch (error: any) {
    console.error('[Socket.IO] Error in remove_reaction:', error.message);
    if (callback) callback({ success: false, error: error.message });
  }
});
```

---

## Step 2.4: Frontend - Types

### File: `client/src/types/index.ts`

Add reaction types:

```typescript
export interface MessageReactions {
  [emoji: string]: string[]; // emoji -> array of user IDs
}

// Update Message interface to include reactions
export interface Message {
  // ... existing fields
  reactions?: MessageReactions;
}
```

---

## Step 2.5: Frontend - Socket Events

### File: `client/src/lib/socket.ts`

Add reaction event handlers (if not already present in types):

```typescript
// Add to SocketEvents interface
export interface SocketEvents {
  // ... existing events

  // Reaction events
  add_reaction: (data: { messageId: string; emoji: string }) => void;
  remove_reaction: (data: { messageId: string; emoji: string }) => void;
  reaction_added: (data: {
    messageId: string;
    reactions: Record<string, string[]>;
    userId: string;
    emoji: string;
  }) => void;
  reaction_removed: (data: {
    messageId: string;
    reactions: Record<string, string[]>;
    userId: string;
    emoji: string;
  }) => void;
}
```

---

## Step 2.6: Frontend - Reaction Components

### File: `client/src/components/chat/ReactionPicker.tsx`

Beautiful emoji picker component:

```typescript
import { useState } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import * as Popover from '@radix-ui/react-popover';
import { Smile } from 'lucide-react';

// Quick reactions (most common)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

interface ReactionPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export default function ReactionPicker({ onEmojiSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  const handleQuickReaction = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="Add reaction"
        >
          <Smile className="h-4 w-4" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 rounded-lg border border-border bg-popover shadow-lg"
          sideOffset={5}
        >
          <div className="p-2">
            {/* Quick Reactions */}
            <div className="flex gap-1 mb-2 pb-2 border-b border-border">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickReaction(emoji)}
                  className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Full Emoji Picker */}
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={320}
              height={400}
              searchPlaceHolder="Search emojis..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

### File: `client/src/components/chat/MessageReactions.tsx`

Display reactions under messages:

```typescript
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
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(reactions).map(([emoji, userIds]) => {
        const count = userIds.length;
        const hasReacted = currentUser && userIds.includes(currentUser.id);

        return (
          <Tooltip.Provider key={emoji}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => onReactionToggle(emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm transition-colors',
                    hasReacted
                      ? 'bg-primary/20 border border-primary text-primary'
                      : 'bg-muted border border-border hover:bg-accent'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-xs font-medium">{count}</span>
                </button>
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md"
                  sideOffset={5}
                >
                  {count === 1
                    ? hasReacted
                      ? 'You reacted'
                      : '1 person reacted'
                    : `${count} people reacted`}
                  <Tooltip.Arrow className="fill-popover" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      })}
    </div>
  );
}
```

---

## Step 2.7: Frontend - Update MessageItem

### File: `client/src/components/chat/MessageItem.tsx`

Update to include reactions:

```typescript
import { useState } from 'react';
import { emit } from '@/lib/socket';
import ReactionPicker from './ReactionPicker';
import MessageReactions from './MessageReactions';
import { MoreVertical, Smile } from 'lucide-react';

// ... existing imports and code

export default function MessageItem({ message, isOwnMessage }: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);

  const handleAddReaction = (emoji: string) => {
    emit('add_reaction', { messageId: message.id, emoji });
  };

  const handleReactionToggle = (emoji: string) => {
    const currentUser = useCurrentUser(); // Assuming hook available
    const hasReacted = message.reactions?.[emoji]?.includes(currentUser.data?.id || '');

    if (hasReacted) {
      emit('remove_reaction', { messageId: message.id, emoji });
    } else {
      emit('add_reaction', { messageId: message.id, emoji });
    }
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Existing message content */}
      <div className="flex items-start gap-3">
        {/* ... avatar, name, content ... */}
      </div>

      {/* Hover Actions Toolbar */}
      {showActions && !message.isDeleted && (
        <div className="absolute -top-3 right-4 flex gap-1 rounded-lg border border-border bg-background shadow-md p-1">
          <ReactionPicker onEmojiSelect={handleAddReaction} />
          {/* ... other actions (edit, delete, etc.) ... */}
        </div>
      )}

      {/* Display Reactions */}
      <MessageReactions
        reactions={message.reactions}
        onReactionToggle={handleReactionToggle}
      />
    </div>
  );
}
```

---

## Step 2.8: Frontend - Real-time Updates

### File: `client/src/components/chat/MessageList.tsx`

Subscribe to reaction events:

```typescript
import { useEffect } from 'react';
import { on, off } from '@/lib/socket';
import { useQueryClient } from '@tanstack/react-query';

export default function MessageList({ conversationId }: MessageListProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Handle reaction_added event
    const handleReactionAdded = (data: any) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === data.messageId
                ? { ...msg, reactions: data.reactions }
                : msg
            ),
          })),
        };
      });
    };

    // Handle reaction_removed event
    const handleReactionRemoved = (data: any) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((msg: any) =>
              msg.id === data.messageId
                ? { ...msg, reactions: data.reactions }
                : msg
            ),
          })),
        };
      });
    };

    on('reaction_added', handleReactionAdded);
    on('reaction_removed', handleReactionRemoved);

    return () => {
      off('reaction_added', handleReactionAdded);
      off('reaction_removed', handleReactionRemoved);
    };
  }, [conversationId, queryClient]);

  // ... rest of component
}
```

---

## Testing Plan

### Backend Tests
1. ✅ Can add reaction to message
2. ✅ Cannot react to deleted messages
3. ✅ Cannot react to messages in conversations you're not in
4. ✅ Reaction array is created if doesn't exist
5. ✅ User ID is added only once per emoji
6. ✅ Can remove own reaction
7. ✅ Empty emoji arrays are deleted
8. ✅ Reactions persist correctly in database
9. ✅ Socket events broadcast correctly

### Frontend Tests
1. ✅ Reaction picker opens on hover button click
2. ✅ Quick reactions work (top 6 emojis)
3. ✅ Full emoji picker works
4. ✅ Reactions display under messages
5. ✅ Current user's reactions are highlighted
6. ✅ Click reaction to toggle
7. ✅ Reaction count displays correctly
8. ✅ Real-time updates when others react
9. ✅ Tooltip shows reaction count
10. ✅ Works in both DM and group chats

### Edge Cases
1. ✅ Multiple users same emoji
2. ✅ Same user multiple emojis
3. ✅ Rapid add/remove same reaction
4. ✅ Reaction to old messages
5. ✅ Network failures during reaction

---

## Success Criteria

- [ ] Backend service functions implemented
- [ ] Socket.IO handlers added
- [ ] Frontend components created
- [ ] Real-time updates working
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] Code committed and pushed
- [ ] Documentation updated

---

## Timeline

**Estimated Time**: 3-4 hours
- Backend implementation: 1 hour
- Frontend components: 1.5 hours
- Testing & bug fixes: 1 hour
- Documentation: 30 minutes
