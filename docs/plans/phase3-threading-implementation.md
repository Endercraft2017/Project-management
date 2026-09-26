# Phase 3: Threaded Conversations - Detailed Implementation Plan

## Overview
Implement Slack-style threaded conversations allowing users to reply to messages in dedicated threads. This keeps the main conversation clean while enabling focused discussions.

## User Requirements (What You Want)
- Users can reply to any message in a thread
- Thread replies appear in a sidebar (like Slack)
- Main chat shows thread preview with reply count
- Threads are **1-level only** (no nested threads)
- Real-time updates for thread replies
- Thread navigation with URL support
- Clear visual indicators for messages with threads

## Prerequisites
- Phase 1 (Team Invitations) completed ✅
- Phase 2 (Message Reactions) completed ✅
- Database schema allows nullable `parentMessageId` ✅

---

## Step 3.1: Database Schema Changes

### File: `server/prisma/schema.prisma`

Add threading fields to Message model:

```prisma
model Message {
  id             String   @id @default(uuid())
  conversationId String
  senderId       String
  content        String   @db.Text
  attachments    Json?
  reactions      Json?

  // Threading support
  parentMessageId    String?  // Null for main messages, set for replies
  threadRepliesCount Int      @default(0) // Denormalized for performance

  isEdited       Boolean  @default(false)
  isDeleted      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id], onDelete: Restrict)
  files        File[]

  // Self-referential relations for threading
  parentMessage Message?  @relation("MessageThread", fields: [parentMessageId], references: [id], onDelete: Cascade)
  replies       Message[] @relation("MessageThread")

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
  @@index([parentMessageId]) // CRITICAL for thread queries
  @@map("messages")
}
```

**Key Points:**
- `parentMessageId` - Points to parent message (null for main messages)
- `threadRepliesCount` - Denormalized count for performance (avoid counting queries)
- Self-referential relation allows threads
- Index on `parentMessageId` for fast thread queries

---

## Step 3.2: Create Migration

### Migration SQL
```sql
-- Add threading columns to messages table
ALTER TABLE messages
ADD COLUMN "parentMessageId" TEXT,
ADD COLUMN "threadRepliesCount" INTEGER DEFAULT 0 NOT NULL;

-- Add foreign key constraint for self-referential relation
ALTER TABLE messages
ADD CONSTRAINT messages_parentMessageId_fkey
FOREIGN KEY ("parentMessageId")
REFERENCES messages(id)
ON DELETE CASCADE;

-- Create index for thread queries
CREATE INDEX messages_parentMessageId_idx ON messages("parentMessageId");
```

**Commands:**
```bash
npx prisma migrate dev --name add_message_threading
npx prisma generate
```

---

## Step 3.3: Backend Thread Service

### File: `server/src/chat/thread-service.ts`

```typescript
import prisma from '@/database/client';
import { isMemberOfConversation } from './conversation-service';

/**
 * Send a reply in a thread
 */
export async function sendThreadReply(
  parentMessageId: string,
  senderId: string,
  content: string
) {
  // 1. Get parent message
  const parentMessage = await prisma.message.findUnique({
    where: { id: parentMessageId },
  });

  if (!parentMessage) {
    throw new Error('Parent message not found');
  }

  // 2. Prevent replies to replies (1-level threading only)
  if (parentMessage.parentMessageId) {
    throw new Error('Cannot reply to a thread reply. Replies must be to main messages only.');
  }

  // 3. Verify user is conversation member
  const isMember = await isMemberOfConversation(
    parentMessage.conversationId,
    senderId
  );

  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 4. Cannot reply to deleted messages
  if (parentMessage.isDeleted) {
    throw new Error('Cannot reply to deleted messages');
  }

  // 5. Create reply in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create thread reply
    const reply = await tx.message.create({
      data: {
        conversationId: parentMessage.conversationId,
        senderId,
        content: content.trim(),
        parentMessageId,
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

    // Increment parent's reply count
    await tx.message.update({
      where: { id: parentMessageId },
      data: {
        threadRepliesCount: {
          increment: 1,
        },
      },
    });

    return reply;
  });

  console.log(`[Audit] User ${senderId} replied to thread ${parentMessageId}`);

  return {
    id: result.id,
    conversationId: result.conversationId,
    senderId: result.senderId,
    senderName: result.sender.name,
    senderAvatarUrl: result.sender.picture,
    content: result.content,
    parentMessageId: result.parentMessageId,
    reactions: result.reactions,
    isEdited: result.isEdited,
    isDeleted: result.isDeleted,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Get thread replies for a message
 */
export async function getThreadReplies(
  parentMessageId: string,
  userId: string,
  limit: number = 50,
  cursor?: string
) {
  // 1. Get parent message to verify conversation
  const parentMessage = await prisma.message.findUnique({
    where: { id: parentMessageId },
  });

  if (!parentMessage) {
    throw new Error('Parent message not found');
  }

  // 2. Verify user is conversation member
  const isMember = await isMemberOfConversation(
    parentMessage.conversationId,
    userId
  );

  if (!isMember) {
    throw new Error('Not a member of this conversation');
  }

  // 3. Get thread replies with pagination
  const replies = await prisma.message.findMany({
    where: {
      parentMessageId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
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
    orderBy: {
      createdAt: 'asc', // Chronological order for threads
    },
    take: limit,
  });

  return {
    replies: replies.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      senderName: r.sender.name,
      senderAvatarUrl: r.sender.picture,
      content: r.isDeleted ? '[deleted]' : r.content,
      parentMessageId: r.parentMessageId,
      reactions: r.reactions,
      isEdited: r.isEdited,
      isDeleted: r.isDeleted,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    hasMore: replies.length === limit,
  };
}

/**
 * Delete thread reply
 */
export async function deleteThreadReply(replyId: string, userId: string) {
  const reply = await prisma.message.findUnique({
    where: { id: replyId },
  });

  if (!reply || !reply.parentMessageId) {
    throw new Error('Thread reply not found');
  }

  if (reply.isDeleted) {
    throw new Error('Reply already deleted');
  }

  // Permission check (sender or admin)
  const isSender = reply.senderId === userId;
  const isAdmin = await isAdminOfConversation(reply.conversationId, userId);

  if (!isSender && !isAdmin) {
    throw new Error('You can only delete your own replies or be a group admin');
  }

  // Soft delete in transaction
  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: replyId },
      data: { isDeleted: true },
    });

    // Decrement parent's reply count
    await tx.message.update({
      where: { id: reply.parentMessageId! },
      data: {
        threadRepliesCount: {
          decrement: 1,
        },
      },
    });
  });

  console.log(`[Audit] User ${userId} deleted thread reply ${replyId}`);

  return { id: replyId, isDeleted: true };
}
```

---

## Step 3.4: Validators

### File: `server/src/chat/validators.ts`

Add thread schemas:

```typescript
export const sendThreadReplySchema = z.object({
  parentMessageId: z.string().uuid('Invalid message ID'),
  content: z
    .string()
    .min(1, 'Reply cannot be empty')
    .max(10000, 'Reply too long')
    .trim(),
});

export const getThreadRepliesSchema = z.object({
  parentMessageId: z.string().uuid('Invalid message ID'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

---

## Step 3.5: Socket.IO Handlers

### File: `server/src/chat/socket-handlers.ts`

Add thread event handlers:

```typescript
/**
 * Event: send_thread_reply
 * User sends a reply in a thread
 */
socket.on('send_thread_reply', async (data, callback) => {
  try {
    // Rate limiting
    if (!messageRateLimiter.check(socket.id)) {
      if (callback)
        callback({ success: false, error: 'Too many messages. Please slow down.' });
      return;
    }

    // Validate input
    const parsed = sendThreadReplySchema.parse(data);
    const { parentMessageId, content } = parsed;

    // Send reply via service
    const reply = await threadService.sendThreadReply(
      parentMessageId,
      userId,
      content
    );

    console.log(`[Socket.IO] Thread reply sent by ${userName} to message ${parentMessageId}`);

    // Send acknowledgment
    if (callback) callback({ success: true, data: reply });

    // Broadcast to all in conversation room
    io.to(`conversation:${reply.conversationId}`).emit('thread_reply_added', {
      reply,
      parentMessageId,
    });
  } catch (error: any) {
    console.error('[Socket.IO] Error in send_thread_reply:', error.message);
    if (callback) callback({ success: false, error: error.message });
  }
});

/**
 * Event: get_thread_replies
 * Fetch replies for a thread
 */
socket.on('get_thread_replies', async (data, callback) => {
  try {
    const parsed = getThreadRepliesSchema.parse(data);
    const { parentMessageId, cursor, limit } = parsed;

    const result = await threadService.getThreadReplies(
      parentMessageId,
      userId,
      limit,
      cursor
    );

    if (callback) callback({ success: true, data: result });
  } catch (error: any) {
    console.error('[Socket.IO] Error in get_thread_replies:', error.message);
    if (callback) callback({ success: false, error: error.message });
  }
});
```

---

## Step 3.6: Frontend Types

### File: `client/src/types/index.ts`

Update Message interface and add Socket events:

```typescript
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  reactions?: Record<string, string[]>;
  parentMessageId?: string | null; // Thread support
  threadRepliesCount?: number; // Thread support
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  sender: { id: string; name: string; picture?: string };
}

// Add to SocketEvents
export interface SocketEvents {
  // ... existing events

  // Thread events
  send_thread_reply: (data: { parentMessageId: string; content: string }) => void;
  get_thread_replies: (data: { parentMessageId: string; cursor?: string }) => void;
  thread_reply_added: (data: { reply: Message; parentMessageId: string }) => void;
}
```

---

## Step 3.7: Frontend Components

### File: `client/src/components/chat/ThreadSidebar.tsx`

```typescript
import { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { emit, on, off } from '@/lib/socket';
import { useCurrentUser } from '@/hooks/useUsers';
import MessageItem from './MessageItem';
import type { Message } from '@/types';

interface ThreadSidebarProps {
  parentMessage: Message;
  onClose: () => void;
}

export default function ThreadSidebar({ parentMessage, onClose }: ThreadSidebarProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    // Fetch thread replies
    emit('get_thread_replies',
      { parentMessageId: parentMessage.id },
      (response: any) => {
        if (response.success) {
          setReplies(response.data.replies);
        }
      }
    );

    // Listen for new thread replies
    const handleThreadReply = (data: any) => {
      if (data.parentMessageId === parentMessage.id) {
        setReplies((prev) => [...prev, data.reply]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    };

    on('thread_reply_added', handleThreadReply);

    return () => {
      off('thread_reply_added', handleThreadReply);
    };
  }, [parentMessage.id]);

  const handleSendReply = () => {
    if (!replyContent.trim() || isSending) return;

    setIsSending(true);
    emit(
      'send_thread_reply',
      {
        parentMessageId: parentMessage.id,
        content: replyContent,
      },
      (response: any) => {
        setIsSending(false);
        if (response.success) {
          setReplyContent('');
        } else {
          alert(response.error || 'Failed to send reply');
        }
      }
    );
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] border-l border-border bg-background shadow-lg flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-semibold">Thread</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Parent Message */}
      <div className="border-b border-border p-4 bg-muted/30">
        <MessageItem
          message={parentMessage}
          isOwn={parentMessage.senderId === currentUser?.id}
        />
      </div>

      {/* Thread Replies */}
      <div className="flex-1 overflow-y-auto p-4">
        {replies.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No replies yet. Start the conversation!
          </p>
        ) : (
          replies.map((reply) => (
            <MessageItem
              key={reply.id}
              message={reply}
              isOwn={reply.senderId === currentUser?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
            placeholder="Reply in thread..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isSending}
          />
          <button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || isSending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### File: `client/src/components/chat/ThreadPreview.tsx`

```typescript
import { MessageCircle } from 'lucide-react';

interface ThreadPreviewProps {
  replyCount: number;
  onClick: () => void;
}

export default function ThreadPreview({ replyCount, onClick }: ThreadPreviewProps) {
  if (replyCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <MessageCircle className="h-4 w-4" />
      <span>
        {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
      </span>
    </button>
  );
}
```

---

## Step 3.8: Integration

### Update MessageItem

Add thread preview and "Reply in thread" button:

```typescript
import ThreadPreview from './ThreadPreview';

// In MessageItem component, add:
const handleReplyInThread = () => {
  // Emit event to parent to open thread sidebar
  window.dispatchEvent(new CustomEvent('open-thread', {
    detail: { message }
  }));
};

// In render, after reactions:
<ThreadPreview
  replyCount={message.threadRepliesCount || 0}
  onClick={handleReplyInThread}
/>
```

### Update ChatView

Manage thread sidebar state:

```typescript
const [activeThread, setActiveThread] = useState<Message | null>(null);

useEffect(() => {
  const handleOpenThread = (e: CustomEvent) => {
    setActiveThread(e.detail.message);
  };

  window.addEventListener('open-thread', handleOpenThread);
  return () => window.removeEventListener('open-thread', handleOpenThread);
}, []);

// In render:
{activeThread && (
  <ThreadSidebar
    parentMessage={activeThread}
    onClose={() => setActiveThread(null)}
  />
)}
```

---

## Testing Checklist

### Backend Tests
- [ ] Can send thread reply to main message
- [ ] Cannot reply to a reply (1-level enforcement)
- [ ] Thread reply count increments correctly
- [ ] Thread reply count decrements on delete
- [ ] Cannot reply to deleted messages
- [ ] Only conversation members can reply
- [ ] Pagination works for thread replies
- [ ] Soft delete works for thread replies

### Frontend Tests
- [ ] Thread sidebar opens when clicking reply count
- [ ] Thread sidebar shows parent message at top
- [ ] Can send reply in thread
- [ ] New replies appear in real-time
- [ ] Reply count updates when replies added
- [ ] Can close thread sidebar
- [ ] Reactions work in thread replies
- [ ] Edit/delete work in thread replies

---

## Success Criteria

- [ ] Backend threading service implemented
- [ ] Database migration successful
- [ ] Socket.IO handlers added
- [ ] ThreadSidebar component created
- [ ] ThreadPreview component created
- [ ] Integration complete
- [ ] Both builds successful (0 errors)
- [ ] All tests passing
- [ ] Changes committed and pushed

---

## Timeline

**Estimated: 4-5 hours**
- Database + Migration: 30 mins
- Backend service: 1.5 hours
- Frontend components: 2 hours
- Testing + fixes: 1 hour
