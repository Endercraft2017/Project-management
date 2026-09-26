# Enhanced Chat System Implementation Plan

## Overview
Transform the current basic chat system into a comprehensive Slack-style communication platform with team invitations, threaded conversations, reactions, mentions, and modern UX features.

## Project Context
- **Current State**: Basic DM and group chat with Socket.IO, typing indicators, and message editing
- **Tech Stack**: Node.js + Express + Prisma + PostgreSQL + Socket.IO + React + TanStack Query
- **Deployment**: Railway (Production)
- **Timeline**: 8 weeks (phased approach)

---

## Phase 1: Team Invitations (Week 1-2)

### 1.1 Database Schema Changes

**Add to `server/prisma/schema.prisma`:**

```prisma
enum InviteStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

model TeamInvite {
  id          String        @id @default(uuid())
  email       String
  token       String        @unique @default(uuid())
  role        Role          @default(MEMBER)
  status      InviteStatus  @default(PENDING)
  invitedById String
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime      @default(now())

  invitedBy   User          @relation("InviteCreator", fields: [invitedById], references: [id], onDelete: Cascade)

  @@index([email])
  @@index([token])
  @@index([status])
  @@index([expiresAt])
  @@map("team_invites")
}

// Update User model - add this relation
model User {
  // ... existing fields
  sentInvites     TeamInvite[]  @relation("InviteCreator")
}
```

**Migration Steps:**
1. Run `npx prisma migrate dev --name add_team_invitations`
2. Test migration in development
3. Deploy to Railway with `npx prisma migrate deploy`

### 1.2 Backend Implementation

**File: `server/src/invites/service.ts`**
- `createInvite(email, role, invitedById)` - Create invitation with 7-day expiry
- `acceptInvite(token, userData)` - Validate token and create user account
- `listInvites(filters)` - Get pending/accepted invites for admin
- `revokeInvite(inviteId)` - Cancel pending invitation
- `resendInvite(inviteId)` - Resend email for pending invite
- `cleanupExpiredInvites()` - Background job to mark expired invites

**File: `server/src/invites/controller.ts`**
- `sendInvite` - Admin endpoint to send invitation
- `acceptInvite` - Public endpoint to accept invitation
- `listInvites` - Admin endpoint to view all invitations
- `revokeInvite` - Admin endpoint to cancel invitation

**File: `server/src/invites/routes.ts`**
```typescript
POST   /api/invites              (isAdmin) - Send invitation
POST   /api/invites/accept       (public)  - Accept invitation
GET    /api/invites              (isAdmin) - List invitations
DELETE /api/invites/:id          (isAdmin) - Revoke invitation
POST   /api/invites/:id/resend   (isAdmin) - Resend invitation email
```

**File: `server/src/invites/validators.ts`**
- Zod schemas for all endpoints
- Email validation with domain restriction (@servicebay.ai)
- Token format validation

**File: `server/src/lib/email.ts`**
- Email service using Nodemailer
- HTML templates for invitation emails
- Configuration for SMTP (Railway environment variables)
- Retry logic for failed sends

**Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@servicebay.ai
SMTP_PASS=***
APP_URL=https://project-management-production-833f.up.railway.app
```

### 1.3 Frontend Implementation

**File: `client/src/components/invites/InviteUserDialog.tsx`**
- Modal dialog for admins
- Email input with validation
- Role selector (Admin/Member)
- Success/error toast notifications
- "Copy invite link" functionality

**File: `client/src/components/invites/InvitesList.tsx`**
- Table showing all sent invitations
- Status badges (Pending/Accepted/Expired/Revoked)
- Actions: Resend, Revoke
- Pagination support

**File: `client/src/pages/AcceptInvitePage.tsx`**
- Public page accessible without login
- Token validation
- User registration form (name, optionally password)
- Google OAuth integration (preferred)
- Auto-login after acceptance

**File: `client/src/hooks/useInvites.ts`**
- `useInvites()` - Fetch invitations list
- `useSendInvite()` - Mutation to send invite
- `useAcceptInvite()` - Mutation to accept invite
- `useRevokeInvite()` - Mutation to revoke invite

**Navigation Changes:**
- Add "Invite Members" button to header (admin only)
- Add "Team" section in sidebar to view members and invites

### 1.4 Testing Checklist
- [ ] Admin can send invitation with valid @servicebay.ai email
- [ ] Invitation email is received with correct link
- [ ] Token expires after 7 days
- [ ] Cannot accept expired invitation
- [ ] User is created and can log in after accepting
- [ ] Cannot reuse accepted invitation token
- [ ] Admin can see pending invitations
- [ ] Admin can revoke pending invitation
- [ ] Cannot accept revoked invitation
- [ ] New user appears in chat conversation lists

---

## Phase 2: Message Reactions (Week 2)

### 2.1 Database Schema
**No changes needed** - `reactions Json?` already exists in Message model

**Data Structure:**
```typescript
// reactions field format
{
  "👍": ["user-id-1", "user-id-2"],
  "❤️": ["user-id-3"],
  "😂": ["user-id-1", "user-id-4"]
}
```

### 2.2 Backend Implementation

**File: `server/src/chat/message-service.ts` (extend existing)**
- `addReaction(messageId, userId, emoji)` - Add user to emoji reactions
- `removeReaction(messageId, userId, emoji)` - Remove user from emoji reactions
- Validate user is conversation member
- Auto-cleanup empty reaction arrays

**File: `server/src/chat/socket-handlers.ts` (extend existing)**
```typescript
socket.on('add_reaction', { messageId, emoji })
socket.on('remove_reaction', { messageId, emoji })
// Emit: 'reaction_added', 'reaction_removed' to conversation room
```

**File: `server/src/chat/validators.ts` (add schemas)**
- `reactionSchema` - Validate emoji format
- Limit to Unicode emoji only (no custom emojis)

### 2.3 Frontend Implementation

**File: `client/src/components/chat/ReactionPicker.tsx`**
- Emoji picker dropdown (use emoji-picker-react)
- Quick reactions bar (👍 ❤️ 😂 😮 😢 🎉)
- Search functionality
- Recent emojis tracking

**File: `client/src/components/chat/MessageReactions.tsx`**
- Display reactions under message
- Show count for each emoji
- Highlight if current user reacted
- Click to toggle reaction
- Tooltip showing who reacted

**File: `client/src/components/chat/MessageItem.tsx` (update)**
- Add hover actions toolbar
- Include reaction picker button
- Display `<MessageReactions />` component
- Real-time reaction updates via Socket.IO

**Keyboard Shortcuts:**
- Hover message + Press `R` = Open reaction picker
- Press 1-6 for quick reactions

### 2.4 Testing Checklist
- [ ] Can add reaction to any message in conversations you're part of
- [ ] Cannot react to messages in conversations you're not in
- [ ] Reactions update in real-time for all conversation members
- [ ] Can toggle reaction on/off
- [ ] Reaction count displays correctly
- [ ] Multiple users can react with same emoji
- [ ] Empty reactions are cleaned up
- [ ] Works in both DM and group chats
- [ ] Works in threaded replies

---

## Phase 3: Threaded Conversations (Week 3-4)

### 3.1 Database Schema Changes

**Update `server/prisma/schema.prisma`:**

```prisma
model Message {
  // ... existing fields

  // Threading support
  parentMessageId    String?  // Null for main messages, set for replies
  threadRepliesCount Int      @default(0) // Denormalized for performance

  // Self-referential relations
  parentMessage      Message?  @relation("MessageThread", fields: [parentMessageId], references: [id], onDelete: Cascade)
  replies            Message[] @relation("MessageThread")

  // ... rest of existing fields

  @@index([parentMessageId]) // CRITICAL for thread queries
}
```

**Migration Steps:**
1. Run migration: `npx prisma migrate dev --name add_message_threading`
2. Backfill `threadRepliesCount` for existing messages
3. Deploy to production

### 3.2 Backend Implementation

**File: `server/src/chat/message-service.ts` (extend)**
- `sendThreadReply(parentMessageId, senderId, content)`
  - Validate parent exists
  - Prevent replies to replies (1-level only)
  - Increment parent's `threadRepliesCount`
  - Broadcast to conversation room
- `getThreadReplies(parentMessageId, userId, cursor, limit)`
  - Pagination support
  - Verify conversation membership
  - Return replies in chronological order
- `deleteThreadReply(replyId, userId)`
  - Soft delete reply
  - Decrement parent's reply count

**File: `server/src/chat/socket-handlers.ts` (extend)**
```typescript
socket.on('send_thread_reply', { parentMessageId, content })
socket.on('join_thread', { messageId })
socket.on('leave_thread', { messageId })
// Emit: 'thread_reply_added', 'thread_updated'
```

**File: `server/src/chat/routes.ts` (add REST endpoints)**
```typescript
GET /api/conversations/:id/messages/:messageId/thread - Get thread replies
```

### 3.3 Frontend Implementation

**File: `client/src/components/chat/ThreadSidebar.tsx`**
- Fixed right sidebar (400px width)
- Header with thread title and close button
- Parent message display (pinned at top)
- Thread replies list with infinite scroll
- Reply input at bottom
- Real-time updates via Socket.IO
- "Jump to message" button to navigate to parent in main chat

**File: `client/src/components/chat/ThreadPreview.tsx`**
- Button under messages showing reply count
- First 2-3 reply avatars
- "N replies" text
- Last reply timestamp
- Click to open thread sidebar

**File: `client/src/components/chat/MessageItem.tsx` (update)**
- Add "Reply in thread" button on hover
- Show `<ThreadPreview />` if message has replies
- Disable threading in thread sidebar (no nested threads)
- Visual indicator if viewing threaded message

**File: `client/src/components/chat/ChatView.tsx` (update)**
- Manage thread sidebar state
- Resize main chat area when thread open
- Persist open thread in URL (?thread=messageId)
- Handle thread navigation

**File: `client/src/hooks/useMessages.ts` (extend)**
- `useThreadReplies(parentMessageId)` - Fetch replies with infinite scroll
- `useSendThreadReply()` - Mutation to send reply
- Socket.IO event subscriptions

**Layout:**
```
+------------------+----------------------+-------------------+
|  Conversations   |    Main Chat        |   Thread Sidebar  |
|      List        |                     |   (conditional)   |
|    (280px)       |  (flex-1)           |     (400px)       |
+------------------+----------------------+-------------------+
```

### 3.4 UX Enhancements
- Unread indicator for threads with new replies
- Notification when mentioned in thread
- "Following" threads (auto-notify on new replies)
- Collapse/expand thread preview
- Keyboard shortcut: `T` to open thread for selected message

### 3.5 Testing Checklist
- [ ] Can reply to any message in main conversation
- [ ] Cannot reply to a reply (1-level threading enforced)
- [ ] Thread sidebar opens when clicking reply count
- [ ] Replies load with pagination
- [ ] New replies appear in real-time
- [ ] Reply count updates correctly
- [ ] Can close thread sidebar
- [ ] Thread state persists in URL
- [ ] Reactions work in thread replies
- [ ] Mentions work in thread replies
- [ ] Thread works in both DM and groups

---

## Phase 4: @Mentions (Week 4)

### 4.1 Database Schema Changes

**Update `server/prisma/schema.prisma`:**

```prisma
model Message {
  // ... existing fields
  mentions     String[]  @default([]) // Array of mentioned user IDs

  @@index([mentions]) // For querying mentions
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_message_mentions
```

### 4.2 Backend Implementation

**File: `server/src/lib/mentions.ts`**
- `extractMentions(content)` - Parse `@[userId](userName)` format
- `formatMentionForDisplay(content)` - Convert to display format
- `validateMentions(mentions, conversationId)` - Verify users are members

**File: `server/src/chat/message-service.ts` (extend)**
- Extract mentions from message content
- Validate mentioned users are conversation members
- Store valid mentions in mentions array
- Trigger notifications for mentioned users

**File: `server/src/chat/socket-handlers.ts` (extend)**
```typescript
// Emit 'mention_notification' to mentioned users
io.to(`user:${userId}`).emit('mention_notification', {
  messageId,
  conversationId,
  senderId,
  senderName
});
```

**Message Format:**
```
Storage:  "Hey @[user-id-123](John Doe), can you review this?"
Display:  "Hey @John Doe, can you review this?"
```

### 4.3 Frontend Implementation

**File: `client/src/components/chat/MentionInput.tsx`**
- Detect `@` character while typing
- Show dropdown of conversation members
- Filter members by name as user types
- Insert mention in format `@[userId](userName)`
- Handle @ at start or after space only
- Keyboard navigation (↑↓ arrows, Enter to select, Esc to close)

**File: `client/src/components/chat/MentionHighlight.tsx`**
- Parse stored mention format
- Render mentions as styled spans
- Highlight current user's mentions differently
- Click mention to open user profile

**File: `client/src/hooks/useConversationMembers.ts`**
- Fetch members for mention autocomplete
- Cache results per conversation
- Real-time updates when members added/removed

**Styling:**
```css
.mention {
  background: rgb(var(--primary) / 0.1);
  color: rgb(var(--primary));
  padding: 0 4px;
  border-radius: 4px;
  font-weight: 500;
}

.mention-you {
  background: rgb(var(--warning) / 0.2);
  color: rgb(var(--warning));
}
```

### 4.4 Notification Integration
- Desktop notification when mentioned
- Unread badge in conversation list for mentions
- "Mentions & Reactions" filter in search
- Email notification for offline mentions (optional)

### 4.5 Testing Checklist
- [ ] @ triggers member dropdown
- [ ] Can search members while typing
- [ ] Mention is inserted in correct format
- [ ] Mention is highlighted in sent message
- [ ] Current user's mentions styled differently
- [ ] Mentioned users receive notification
- [ ] Cannot mention users not in conversation
- [ ] Mentions work in threads
- [ ] Multiple mentions in one message work
- [ ] Mentions persist after page reload

---

## Phase 5: Notifications System (Week 5)

### 5.1 Database Schema

**Add to `server/prisma/schema.prisma`:**

```prisma
enum NotificationType {
  MENTION
  THREAD_REPLY
  DM_MESSAGE
  ADDED_TO_GROUP
  REACTION
}

model Notification {
  id             String           @id @default(uuid())
  userId         String
  type           NotificationType
  title          String
  body           String
  messageId      String?
  conversationId String?
  threadId       String?          // Parent message ID for thread replies
  actorId        String?          // User who triggered the notification
  isRead         Boolean          @default(false)
  createdAt      DateTime         @default(now())

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  actor          User?            @relation("NotificationActor", fields: [actorId], references: [id])
  message        Message?         @relation(fields: [messageId], references: [id], onDelete: Cascade)
  conversation   Conversation?    @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("notifications")
}

// Update User model
model User {
  // ... existing
  notifications          Notification[]
  triggeredNotifications Notification[] @relation("NotificationActor")
}
```

### 5.2 Backend Implementation

**File: `server/src/notifications/service.ts`**
- `createNotification(userId, type, data)` - Create notification
- `markAsRead(notificationId, userId)` - Mark single as read
- `markAllAsRead(userId)` - Mark all as read
- `getNotifications(userId, filters, pagination)` - Fetch notifications
- `deleteNotification(notificationId, userId)` - Remove notification
- `getUnreadCount(userId)` - Get unread badge count

**Notification Triggers:**
1. **Mention** - When user is @mentioned in message
2. **Thread Reply** - When someone replies to your message thread
3. **DM Message** - When you receive a new DM (if offline)
4. **Added to Group** - When added to new group conversation
5. **Reaction** - When someone reacts to your message (optional, can be disabled)

**File: `server/src/notifications/controller.ts`**
```typescript
GET    /api/notifications              - List notifications
GET    /api/notifications/unread-count - Get unread count
POST   /api/notifications/:id/read     - Mark as read
POST   /api/notifications/read-all     - Mark all as read
DELETE /api/notifications/:id          - Delete notification
```

**File: `server/src/notifications/socket-handlers.ts`**
```typescript
// Emit to user's socket when notification created
io.to(`user:${userId}`).emit('new_notification', notification);
```

### 5.3 Frontend Implementation

**File: `client/src/components/notifications/NotificationBell.tsx`**
- Bell icon in header
- Unread count badge
- Dropdown panel showing recent notifications
- Click to mark as read and navigate to message
- "Mark all as read" button
- "View all" link to notifications page

**File: `client/src/components/notifications/NotificationItem.tsx`**
- Icon based on notification type
- Actor avatar and name
- Notification text
- Time ago
- Unread indicator (blue dot)
- Click handler to navigate

**File: `client/src/pages/NotificationsPage.tsx`**
- Full-page notifications list
- Filter by type (All/Mentions/Threads/Messages)
- Filter by read status
- Infinite scroll pagination
- Bulk actions (mark all read, delete read)

**File: `client/src/hooks/useNotifications.ts`**
- `useNotifications(filters)` - Fetch notifications
- `useUnreadCount()` - Get unread count for badge
- `useMarkAsRead()` - Mutation to mark read
- `useMarkAllAsRead()` - Mutation to mark all read
- Socket.IO subscription for real-time updates

**Browser Notifications:**
- Request permission on first login
- Show desktop notification for important events
- Notification click opens app to relevant message
- Respect user's browser notification settings

### 5.4 Notification Preferences

**File: `client/src/components/settings/NotificationSettings.tsx`**
- Toggle notifications by type
- Desktop notification enable/disable
- Email notification enable/disable
- "Do Not Disturb" mode with schedule

**Database Schema Addition:**
```prisma
model UserSettings {
  userId                    String  @id
  notifyOnMention           Boolean @default(true)
  notifyOnThreadReply       Boolean @default(true)
  notifyOnDM                Boolean @default(true)
  notifyOnReaction          Boolean @default(false)
  desktopNotifications      Boolean @default(true)
  emailNotifications        Boolean @default(false)
  doNotDisturbEnabled       Boolean @default(false)
  doNotDisturbStart         String? // "22:00"
  doNotDisturbEnd           String? // "08:00"

  user                      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_settings")
}
```

### 5.5 Testing Checklist
- [ ] Notification created when mentioned
- [ ] Notification created when thread replied
- [ ] Notification created for new DM
- [ ] Notification created when added to group
- [ ] Unread count shows in bell icon
- [ ] Desktop notification shows (with permission)
- [ ] Clicking notification navigates correctly
- [ ] Can mark individual notification as read
- [ ] Can mark all as read
- [ ] Preferences are respected
- [ ] Do Not Disturb mode works
- [ ] Real-time updates via Socket.IO

---

## Phase 6: Search Functionality (Week 5-6)

### 6.1 Database Optimization

**Add full-text search index to `schema.prisma`:**

```prisma
model Message {
  // ... existing fields

  @@index([content(ops: raw("gin_trgm_ops"))], type: Gin) // PostgreSQL full-text
}
```

**Enable PostgreSQL extensions:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX message_content_gin ON messages USING gin(content gin_trgm_ops);
```

### 6.2 Backend Implementation

**File: `server/src/search/service.ts`**
- `searchMessages(userId, query, filters)` - Full-text message search
  - Filter by conversation
  - Filter by sender
  - Filter by date range
  - Filter by has:mentions, has:threads, has:reactions
  - Relevance scoring
- `searchConversations(userId, query)` - Search conversation names
- `searchUsers(query)` - Search team members by name/email

**File: `server/src/search/controller.ts`**
```typescript
GET /api/search/messages       - Search messages
GET /api/search/conversations  - Search conversations
GET /api/search/users          - Search users
```

**Search Query Syntax:**
- Plain text: `"project deadline"`
- From user: `from:john project`
- In conversation: `in:general project`
- Has mentions: `has:mention @john`
- Has reactions: `has:reaction 👍`
- Date range: `after:2024-01-01 before:2024-12-31`

### 6.3 Frontend Implementation

**File: `client/src/components/search/SearchDialog.tsx`**
- Global search (Cmd/Ctrl + K)
- Search input with query syntax help
- Tabbed results: Messages / Conversations / People
- Result preview with context
- Highlight matching text
- Click result to navigate
- Recent searches

**File: `client/src/components/search/SearchFilters.tsx`**
- Advanced filters panel
- Date picker for range
- Conversation selector
- User selector
- Checkboxes for has:mention, has:thread, has:reaction

**File: `client/src/components/search/SearchResult.tsx`**
- Result item component
- Shows message preview with context (before/after lines)
- Shows conversation name
- Shows sender and timestamp
- Highlights search term
- Click to jump to message

**File: `client/src/hooks/useSearch.ts`**
- `useSearchMessages(query, filters)` - Search with debounce
- `useSearchHistory()` - Recent searches
- Cache search results

**Keyboard Shortcuts:**
- `Cmd/Ctrl + K` - Open search
- `↑↓` - Navigate results
- `Enter` - Open selected result
- `Esc` - Close search

### 6.4 Testing Checklist
- [ ] Search finds messages by content
- [ ] Search respects conversation filter
- [ ] Search respects sender filter
- [ ] Search respects date range
- [ ] Search highlights matching text
- [ ] Clicking result navigates to message
- [ ] Recent searches are saved
- [ ] Search works in threads
- [ ] Search is performant (<500ms)
- [ ] Search respects permissions

---

## Phase 7: Enhanced Read Receipts (Week 6)

### 7.1 Database Schema Changes

**Update `server/prisma/schema.prisma`:**

```prisma
model MessageRead {
  id             String   @id @default(uuid())
  messageId      String
  userId         String
  readAt         DateTime @default(now())

  message        Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
  @@index([messageId])
  @@index([userId])
  @@map("message_reads")
}

model Message {
  // ... existing fields
  reads          MessageRead[]
}
```

### 7.2 Backend Implementation

**File: `server/src/chat/read-receipts-service.ts`**
- `markMessageAsRead(messageId, userId)` - Record read
- `markConversationAsRead(conversationId, userId)` - Mark all as read
- `getMessageReads(messageId)` - Get all users who read message
- `getUnreadMessages(conversationId, userId)` - Get unread messages

**File: `server/src/chat/socket-handlers.ts` (extend)**
```typescript
socket.on('mark_message_read', { messageId })
socket.on('mark_conversation_read', { conversationId })
// Emit: 'message_read_by' to sender
```

### 7.3 Frontend Implementation

**File: `client/src/components/chat/ReadReceipts.tsx`**
- Show checkmarks next to own messages
  - Single gray check = Sent
  - Double gray checks = Delivered
  - Double blue checks = Read by all
- Tooltip showing who read (in groups)
- "Seen by" list in message actions

**File: `client/src/components/chat/MessageList.tsx` (update)**
- Auto-mark messages as read when scrolled into view
- Use IntersectionObserver for efficient tracking
- Debounce read receipts (batch every 2 seconds)

### 7.4 Privacy Settings

**Add to UserSettings:**
```prisma
model UserSettings {
  // ... existing
  readReceiptsEnabled    Boolean @default(true)
}
```

- Toggle in Settings to disable sending read receipts
- Other users won't see when you read messages
- You also won't see others' read receipts

### 7.5 Testing Checklist
- [ ] Message marked as read when viewed
- [ ] Read receipts show for own messages
- [ ] Tooltip shows who read in groups
- [ ] Works in DM conversations
- [ ] Works in group conversations
- [ ] Works in threads
- [ ] Privacy setting respected
- [ ] Real-time updates via Socket.IO

---

## Phase 8: Gantt Chart Fixes (Week 7)

### 8.1 Issues to Fix
1. Empty/no tasks - showing blank screen
2. Invalid date ranges causing crashes
3. Initialization errors
4. Performance issues with many tasks

### 8.2 Implementation

**File: `client/src/components/gantt/GanttChart.tsx` (rewrite)**

```typescript
export default function GanttChart({ tasks, viewMode, onTaskChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<Gantt | null>(null);

  // Validate and transform tasks
  const ganttTasks = useMemo(() => {
    return tasks
      .filter(task => {
        // Filter invalid tasks
        const start = new Date(task.startDate);
        const end = new Date(task.deadline);

        return (
          !isNaN(start.getTime()) &&
          !isNaN(end.getTime()) &&
          start < end
        );
      })
      .map(task => ({
        id: task.id,
        name: task.taskName,
        start: format(new Date(task.startDate), 'yyyy-MM-dd'),
        end: format(new Date(task.deadline), 'yyyy-MM-dd'),
        progress: Math.max(0, Math.min(100, task.progress)),
        custom_class: getTaskPriorityClass(task),
      }));
  }, [tasks]);

  useEffect(() => {
    if (!containerRef.current || ganttTasks.length === 0) {
      // Clean up previous instance
      if (ganttRef.current && containerRef.current) {
        containerRef.current.innerHTML = '';
        ganttRef.current = null;
      }
      return;
    }

    try {
      // Always clear before initializing
      containerRef.current.innerHTML = '';

      ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
        view_mode: viewMode,
        date_format: 'YYYY-MM-DD',
        language: 'en',
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month', 'Year'],
        popup_trigger: 'click',
        on_click: (task) => onTaskChange?.(task),
        on_date_change: (task, start, end) => {
          onTaskChange?.({
            ...task,
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd'),
          }, 'date');
        },
        on_progress_change: (task, progress) => {
          onTaskChange?.({ ...task, progress }, 'progress');
        },
      });
    } catch (error) {
      console.error('Gantt initialization error:', error);

      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-full text-destructive">
            <p>Failed to initialize Gantt chart</p>
          </div>
        `;
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      ganttRef.current = null;
    };
  }, [ganttTasks.length, viewMode]);

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-semibold">No Tasks Yet</p>
        <p className="text-sm text-muted-foreground">
          Create tasks with start and end dates to visualize them
        </p>
      </div>
    );
  }

  // All tasks have invalid dates
  if (ganttTasks.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
          <p className="text-lg font-semibold">Invalid Date Ranges</p>
          <p className="text-sm text-muted-foreground">
            All tasks have missing or invalid dates. Please update task dates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-wrapper rounded-lg border bg-card p-4">
      <div ref={containerRef} className="gantt-container" />
    </div>
  );
}
```

**File: `client/src/components/gantt/GanttView.tsx` (update)**
- Add lazy loading for Gantt component
- Add loading skeleton
- Add error boundary
- Add "Export to PDF" button
- Add "Print" button

**File: `client/src/styles/gantt.css` (update)**
- Better dark mode support
- Responsive design
- Print styles

### 8.3 Testing Checklist
- [ ] Shows empty state when no tasks
- [ ] Shows error state when all dates invalid
- [ ] Handles invalid date formats gracefully
- [ ] No console errors on initialization
- [ ] Works with 1 task
- [ ] Works with 100+ tasks
- [ ] View mode switching works
- [ ] Drag to reschedule works (admin only)
- [ ] Progress bar updates work
- [ ] Dark mode styles correct
- [ ] Responsive on mobile

---

## Phase 9: Testing & Polish (Week 8)

### 9.1 End-to-End Testing

**File: `tests/e2e/chat-system.spec.ts`**
- Test invitation flow (send, accept, revoke)
- Test DM creation and messaging
- Test group creation and messaging
- Test threaded conversations
- Test reactions
- Test mentions
- Test search
- Test notifications
- Test read receipts

**File: `tests/e2e/permissions.spec.ts`**
- Test admin-only features
- Test conversation permissions
- Test message deletion permissions
- Test invitation permissions

### 9.2 Performance Optimization

**Backend:**
- Database query optimization (use EXPLAIN ANALYZE)
- Add compound indexes for common queries
- Implement Redis caching for:
  - User online status
  - Unread counts
  - Conversation lists
- Rate limiting adjustments
- WebSocket connection pooling

**Frontend:**
- Code splitting for chat components
- Virtual scrolling for long message lists
- Image lazy loading and compression
- Bundle size optimization
- Lighthouse performance audit

### 9.3 Mobile Responsiveness

**Update all components:**
- Responsive layouts (mobile-first)
- Touch-friendly hit targets (44x44px minimum)
- Swipe gestures (swipe message for actions)
- Bottom sheet for mobile thread view
- Mobile-optimized emoji picker
- Adaptive keyboard handling

### 9.4 Accessibility

**WCAG 2.1 AA Compliance:**
- Keyboard navigation for all features
- ARIA labels and roles
- Focus management
- Screen reader testing
- Color contrast (4.5:1 minimum)
- Skip links
- Error announcements

### 9.5 Documentation

**File: `docs/documentation/chat-system.md`**
- Feature overview
- User guide with screenshots
- Admin guide
- Keyboard shortcuts reference
- Troubleshooting guide

**File: `docs/api/chat-endpoints.md`**
- REST API documentation
- WebSocket events documentation
- Request/response examples
- Error codes reference

**File: `docs/architecture/chat-architecture.md`**
- System architecture diagram
- Database schema diagram
- WebSocket event flow
- Security considerations
- Scalability considerations

### 9.6 Final Checklist
- [ ] All features working in production
- [ ] No console errors or warnings
- [ ] All tests passing (unit, integration, e2e)
- [ ] Performance metrics met (<100ms API, <50ms WebSocket)
- [ ] Mobile responsive
- [ ] Accessibility compliance
- [ ] Documentation complete
- [ ] Admin training completed
- [ ] User onboarding flow tested
- [ ] Monitoring and alerts configured

---

## Technical Specifications

### Performance Targets
- **Message Send Latency**: <50ms (WebSocket)
- **API Response Time**: <100ms (p95)
- **Search Results**: <500ms
- **Typing Indicator Delay**: <100ms
- **Page Load Time**: <2s (FCP)
- **Infinite Scroll**: 50 messages per page
- **Concurrent Users**: Support 100+ simultaneous connections

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

### Security Requirements
- All API endpoints authenticated
- Permission checks on all mutations
- Rate limiting on all WebSocket events
- Input sanitization for message content
- XSS prevention
- CSRF protection (already implemented)
- SQL injection prevention (Prisma handles this)
- Invite token entropy: 256 bits
- Session expiry: 7 days
- WebSocket authentication via session

### Monitoring & Alerts
- Application error tracking (Sentry)
- Performance monitoring (New Relic/Datadog)
- WebSocket connection metrics
- Database query performance
- Email delivery success rate
- Notification delivery rate
- User engagement metrics

---

## Risk Mitigation

### Technical Risks
1. **WebSocket Scalability**:
   - Mitigation: Redis adapter for Socket.IO, horizontal scaling

2. **Database Performance**:
   - Mitigation: Proper indexing, query optimization, read replicas

3. **Email Deliverability**:
   - Mitigation: Use reputable SMTP provider (SendGrid/Postmark), SPF/DKIM

4. **Real-time Sync Issues**:
   - Mitigation: Event sourcing, optimistic updates, conflict resolution

### User Experience Risks
1. **Complex UI**:
   - Mitigation: User testing, progressive disclosure, onboarding

2. **Notification Overload**:
   - Mitigation: Smart batching, granular preferences, do-not-disturb

3. **Learning Curve**:
   - Mitigation: Tooltips, help documentation, video tutorials

---

## Success Metrics

### User Engagement
- Daily active users (DAU)
- Messages sent per user per day
- Conversations created per week
- Thread reply rate
- Reaction usage rate
- Search usage rate
- Notification click-through rate

### Performance
- Average message send time
- API p95 response time
- WebSocket connection stability (uptime %)
- Search result accuracy
- Page load time

### Business
- User invitation acceptance rate
- Time to first message (new users)
- User retention (7-day, 30-day)
- Feature adoption rates
- User satisfaction (NPS score)

---

## Deployment Strategy

### Rollout Plan
1. **Week 1-2**: Deploy invitations to production
2. **Week 2**: Deploy reactions (low risk)
3. **Week 3-4**: Deploy threading (high complexity, phased rollout)
4. **Week 4**: Deploy mentions (after threading stabilizes)
5. **Week 5**: Deploy notifications system
6. **Week 5-6**: Deploy search (after indexing)
7. **Week 6**: Deploy read receipts
8. **Week 7**: Deploy Gantt fixes
9. **Week 8**: Final polish and optimization

### Feature Flags
Implement feature flags for:
- Threaded conversations
- Mentions
- Reactions
- Enhanced read receipts
- Search

This allows enabling/disabling features per user or globally.

### Database Migrations
- Test all migrations in staging first
- Run migrations during low-traffic periods
- Have rollback scripts ready
- Monitor database performance after migration
- Keep migrations idempotent

### Monitoring Post-Deployment
- Error rate spike alerts
- Performance degradation alerts
- WebSocket connection drop alerts
- Database slow query alerts
- Email delivery failure alerts

---

## Appendix

### Dependencies to Install
```json
{
  "dependencies": {
    "nodemailer": "^6.9.7",
    "emoji-picker-react": "^4.11.1" // Already installed
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.14"
  }
}
```

### Environment Variables
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@servicebay.ai
SMTP_PASS=your-app-password
SMTP_FROM=ServiceBay PM <noreply@servicebay.ai>

# Application
APP_URL=https://project-management-production-833f.up.railway.app
APP_NAME=ServiceBay PM

# Redis (for Socket.IO scaling - optional for now)
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_THREADING=true
ENABLE_MENTIONS=true
ENABLE_REACTIONS=true
ENABLE_SEARCH=true
```

### Useful Commands
```bash
# Database
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npx prisma studio

# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run tests
npm run test:e2e     # Run E2E tests

# Deployment
git push origin main # Triggers Railway deployment
```

---

## Conclusion

This plan provides a comprehensive, phased approach to building a modern Slack-style chat system with all requested features. The 8-week timeline is aggressive but achievable with focused development. Each phase builds on the previous, minimizing risk and allowing for user feedback.

The key to success is:
1. **Thorough testing** at each phase
2. **Incremental deployment** with feature flags
3. **User feedback** incorporation
4. **Performance monitoring** throughout
5. **Clear documentation** for maintainability

By following this plan, you'll have a production-ready, enterprise-grade chat system that rivals Slack in functionality while being tailored to your project management needs.
