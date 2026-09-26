# Phase 4: @Mentions - Detailed Implementation Plan

## Overview
Implement @mentions functionality to allow users to mention other conversation members. Mentioned users receive notifications and messages are highlighted.

## Requirements
- User can type `@` to trigger mention autocomplete
- Autocomplete shows conversation members filtered by name
- Mentions stored in format: `@[userId](userName)`
- Mentions displayed as styled/highlighted text
- Current user's mentions highlighted differently
- Mentioned users receive real-time notifications
- Works in both main messages and thread replies
- Cannot mention users not in the conversation

## Architecture

### Data Flow
```
User types @ → Fetch conversation members → Show autocomplete
User selects → Insert @[userId](name) → Send message
Backend extracts mentions → Validates members → Stores mention IDs
Backend emits → Mention notifications → Frontend updates
Display parses → Highlights mentions → Shows styled text
```

### Storage Format
```typescript
// Message content
"Hey @[550e8400-e29b-41d4-a716-446655440000](John Doe), can you review this?"

// Mentions array
["550e8400-e29b-41d4-a716-446655440000"]

// Display
"Hey @John Doe, can you review this?"
// with @John Doe styled as a mention
```

## Implementation Steps

### Step 1: Database Schema
**File**: `server/prisma/schema.prisma`

Add to Message model:
```prisma
model Message {
  // ... existing fields
  mentions     String[]  @default([]) // Array of mentioned user IDs

  @@index([mentions]) // For querying messages mentioning specific users
}
```

**Migration**:
```bash
npx prisma migrate dev --name add_message_mentions
npx prisma generate
DATABASE_URL="..." npx prisma migrate deploy  # Railway
```

### Step 2: Backend Utilities
**File**: `server/src/lib/mentions.ts`

Functions:
- `extractMentions(content: string): string[]`
  - Parse content for `@[userId](userName)` pattern
  - Return array of unique user IDs
  - Handle edge cases (malformed mentions, duplicates)

- `validateMentions(mentions: string[], conversationId: string): Promise<string[]>`
  - Query conversation members
  - Filter mentions to only valid members
  - Return validated mention IDs

- `formatMentionForDisplay(content: string): string`
  - Convert storage format to display format
  - Replace `@[userId](name)` with `@name`
  - Preserve mention markers for frontend highlighting

- `getMentionPattern(): RegExp`
  - Regex: `/@\[([a-f0-9-]{36})\]\(([^)]+)\)/g`
  - Matches UUID in brackets, name in parentheses

### Step 3: Update Message Service
**File**: `server/src/chat/message-service.ts`

Update `sendMessage()`:
```typescript
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
) {
  // 1. Extract mentions from content
  const mentionIds = extractMentions(content);

  // 2. Validate mentions (users must be conversation members)
  const validMentions = await validateMentions(mentionIds, conversationId);

  // 3. Create message with mentions
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      mentions: validMentions, // Store validated mentions
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          picture: true,
        },
      },
    },
  });

  return message;
}
```

Update thread reply function similarly.

### Step 4: Socket Handlers
**File**: `server/src/chat/socket-handlers.ts`

Update `send_message` handler:
```typescript
socket.on('send_message', async (data, callback) => {
  try {
    // ... existing validation ...

    // Send message (includes mention extraction)
    const message = await messageService.sendMessage(
      conversationId,
      userId,
      content
    );

    // Broadcast to conversation
    io.to(`conversation:${conversationId}`).emit('new_message', message);

    // Send mention notifications
    if (message.mentions && message.mentions.length > 0) {
      message.mentions.forEach((mentionedUserId) => {
        if (mentionedUserId !== userId) { // Don't notify yourself
          io.to(`user:${mentionedUserId}`).emit('mention_notification', {
            messageId: message.id,
            conversationId: message.conversationId,
            senderId: userId,
            senderName: message.sender.name,
            content: message.content,
          });
        }
      });
    }

    callback({ success: true, data: message });
  } catch (error: any) {
    callback({ success: false, error: error.message });
  }
});
```

Add socket event for joining user rooms:
```typescript
// On connection, join user's personal room for notifications
socket.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);
});
```

### Step 5: Frontend Types
**File**: `client/src/types/index.ts`

Update Message interface:
```typescript
export interface Message {
  // ... existing fields
  mentions?: string[]; // Array of mentioned user IDs
}
```

Add socket event:
```typescript
export interface SocketEvents {
  // ... existing events

  // Mention notification
  mention_notification: (data: {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
  }) => void;
}
```

### Step 6: Mention Autocomplete Hook
**File**: `client/src/hooks/useConversationMembers.ts`

```typescript
export function useConversationMembers(conversationId: string) {
  return useQuery({
    queryKey: ['conversation-members', conversationId],
    queryFn: () =>
      get<{ members: User[] }>(`/api/conversations/${conversationId}/members`),
    enabled: !!conversationId,
  });
}
```

### Step 7: MentionInput Component
**File**: `client/src/components/chat/MentionInput.tsx`

Features:
- Textarea with @ detection
- Dropdown positioned near cursor
- Filter members by name as typing
- Keyboard navigation (↑↓ Enter Esc)
- Insert mention in storage format
- Handle @ only at start or after space

Libraries to consider:
- React Textarea with mentions support
- Or custom implementation with contentEditable

Approach:
- Use textarea with value state
- Detect @ character position
- Show dropdown below cursor
- On select, insert `@[userId](name)` at cursor position

### Step 8: MentionHighlight Component
**File**: `client/src/components/chat/MentionHighlight.tsx`

Parse and render message content with styled mentions:
```typescript
export function MentionHighlight({
  content,
  mentions,
  currentUserId
}: {
  content: string;
  mentions?: string[];
  currentUserId: string;
}) {
  // Parse content for mention pattern
  // Render text with <span className="mention"> for mentions
  // Highlight current user's mentions differently
}
```

CSS classes:
```css
.mention {
  background: rgba(var(--primary-rgb), 0.1);
  color: rgb(var(--primary));
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 500;
  cursor: pointer;
}

.mention-you {
  background: rgba(var(--warning-rgb), 0.2);
  color: rgb(var(--warning));
  font-weight: 600;
}
```

### Step 9: Update MessageInput
**File**: `client/src/components/chat/MessageInput.tsx`

Replace textarea with MentionInput component:
```typescript
<MentionInput
  value={content}
  onChange={setContent}
  conversationId={conversationId}
  onSubmit={handleSendMessage}
  placeholder="Type a message..."
/>
```

### Step 10: Update MessageItem
**File**: `client/src/components/chat/MessageItem.tsx`

Replace plain text content with MentionHighlight:
```typescript
<MentionHighlight
  content={message.content}
  mentions={message.mentions}
  currentUserId={currentUser?.id || ''}
/>
```

### Step 11: Backend API Endpoint
**File**: `server/src/chat/routes.ts`

Add endpoint to get conversation members (if not exists):
```typescript
router.get(
  '/:id/members',
  requireAuth,
  asyncHandler(conversationController.getMembers)
);
```

**File**: `server/src/chat/conversation-controller.ts`
```typescript
export async function getMembers(req: Request, res: Response) {
  const { id: conversationId } = req.params;
  const userId = req.user!.id;

  // Verify user is member
  const isMember = await isMemberOfConversation(conversationId, userId);
  if (!isMember) {
    return res.status(403).json({ error: 'Not a member of this conversation' });
  }

  // Get members
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              picture: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const members = conversation?.members.map((m) => m.user) || [];

  res.json({ members });
}
```

## Testing Plan

### Backend Tests
Create `server/src/chat/test-mentions.ts`:

1. Extract mentions from content
2. Validate mentions (users must be members)
3. Invalid mentions are filtered out
4. Send message with mentions
5. Mentions stored in database
6. Mention notifications emitted via socket
7. Cannot mention non-members

### Frontend Tests (Manual)
1. Type @ triggers autocomplete
2. Autocomplete shows conversation members
3. Search filters members by name
4. Select member inserts mention
5. Send message with mention
6. Mention displayed with highlighting
7. Current user's mentions highlighted differently
8. Mentioned user receives notification
9. Click mention (future: opens profile)
10. Multiple mentions in one message
11. Mentions work in thread replies

## Success Criteria
- ✅ @ character triggers member autocomplete
- ✅ Autocomplete shows only conversation members
- ✅ Mentions stored in correct format
- ✅ Mentions displayed with visual highlighting
- ✅ Current user's mentions styled differently
- ✅ Mentioned users receive real-time notifications
- ✅ Cannot mention non-members
- ✅ Works in main chat and threads
- ✅ No TypeScript errors
- ✅ All tests pass

## Notes
- Keep it simple first - advanced features later:
  - Email notifications for mentions (Phase 5)
  - "Mentions & Reactions" filter/view (Phase 5)
  - Click mention to view profile (Phase 6)
  - @here / @channel mentions (Phase 6)
- Focus on core functionality and UX
- Ensure good keyboard navigation
- Mobile-friendly autocomplete positioning
