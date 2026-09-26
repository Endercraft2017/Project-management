# Feature 7: Real-time Chat System - Documentation

**Version**: 1.0.0
**Status**: Completed
**Last Updated**: 2025-10-10

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [REST API Reference](#rest-api-reference)
5. [WebSocket API Reference](#websocket-api-reference)
6. [Authentication & Authorization](#authentication--authorization)
7. [Client Integration Guide](#client-integration-guide)
8. [Usage Examples](#usage-examples)
9. [Error Handling](#error-handling)
10. [Security](#security)
11. [Performance](#performance)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Best Practices](#best-practices)

---

## Overview

### Purpose

The Real-time Chat System provides secure, real-time messaging capabilities for ServiceBay PM team members. It supports direct messages (DMs) between two users and group conversations for project collaboration.

### Key Features

✅ **Direct Messages**: One-on-one conversations between team members
✅ **Group Conversations**: Multi-user conversations (up to 50 members)
✅ **Real-time Messaging**: Instant message delivery via WebSocket
✅ **Message Editing**: Edit messages within 15 minutes of sending
✅ **Message Deletion**: Soft delete messages (admins can delete any message in groups)
✅ **Typing Indicators**: See when others are typing
✅ **Online Status**: Track which users are online/offline
✅ **Message History**: Paginated message retrieval
✅ **Unread Counts**: Track unread messages per conversation
✅ **Role-based Access**: Admin and member roles in group conversations
✅ **Rate Limiting**: Prevent spam and abuse

### Technology Stack

- **WebSocket**: Socket.IO v4 with fallback to long polling
- **REST API**: Express.js for conversation management
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: Express session shared with WebSocket
- **Validation**: Zod schemas for all inputs
- **Security**: CORS, rate limiting, input sanitization

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Application                     │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │   REST API       │          │   Socket.IO      │        │
│  │   (HTTP/HTTPS)   │          │   (WebSocket)    │        │
│  └────────┬─────────┘          └────────┬─────────┘        │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
            │ HTTP Requests                 │ WebSocket Events
            │                               │
┌───────────┼───────────────────────────────┼──────────────────┐
│           │                               │                  │
│  ┌────────▼─────────┐          ┌─────────▼────────┐        │
│  │  Express Router  │          │  Socket.IO       │        │
│  │  /api/conversations │       │  Server          │        │
│  └────────┬─────────┘          └─────────┬────────┘        │
│           │                               │                  │
│  ┌────────▼─────────┐          ┌─────────▼────────┐        │
│  │  Controllers     │          │  Event Handlers  │        │
│  └────────┬─────────┘          └─────────┬────────┘        │
│           │                               │                  │
│  ┌────────▼──────────────────────────────▼────────┐        │
│  │            Services Layer                       │        │
│  │  - ConversationService                          │        │
│  │  - MessageService                               │        │
│  └────────────────────┬────────────────────────────┘        │
│                       │                                      │
│  ┌────────────────────▼────────────────────────────┐        │
│  │          Prisma Client (ORM)                    │        │
│  └────────────────────┬────────────────────────────┘        │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   PostgreSQL Database                         │
│  - Conversations                                              │
│  - ConversationMembers                                        │
│  - Messages                                                   │
└───────────────────────────────────────────────────────────────┘
```

### File Structure

```
server/src/chat/
├── validators.ts              # Zod validation schemas
├── conversation-service.ts    # Conversation business logic
├── message-service.ts         # Message business logic
├── socket-server.ts           # Socket.IO server singleton
├── socket-middleware.ts       # Authentication & rate limiting
├── socket-handlers.ts         # WebSocket event handlers
├── controller.ts              # REST API controllers
└── routes.ts                  # REST API routes
```

### Data Flow

**REST API Flow**:
```
Client → Router → Middleware (Auth) → Controller → Service → Database → Response
```

**WebSocket Flow**:
```
Client → Socket.IO → Middleware (Auth) → Event Handler → Service → Database
                                                                    ↓
                                         Broadcast to Room ← ───────┘
```

---

## Database Schema

### Conversation Model

```prisma
model Conversation {
  id          String   @id @default(uuid())
  type        String   // 'dm' or 'group'
  name        String?  // For group conversations
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy User                   @relation("CreatedConversations")
  members   ConversationMember[]
  messages  Message[]
}
```

**Fields**:
- `type`: 'dm' for direct messages, 'group' for group conversations
- `name`: Required for groups, null for DMs
- `createdById`: User who created the conversation
- `updatedAt`: Updated when new message is sent

### ConversationMember Model

```prisma
model ConversationMember {
  id             String   @id @default(uuid())
  conversationId String
  userId         String
  role           String   // 'admin' or 'member'
  joinedAt       DateTime @default(now())
  lastReadAt     DateTime @default(now())

  conversation Conversation @relation(...)
  user         User         @relation(...)
}
```

**Fields**:
- `role`: 'admin' can manage members, 'member' has basic access
- `lastReadAt`: Timestamp for calculating unread count

### Message Model

```prisma
model Message {
  id             String    @id @default(uuid())
  conversationId String
  senderId       String
  content        String    @db.Text
  edited         Boolean   @default(false)
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  conversation Conversation @relation(...)
  sender       User         @relation(...)
}
```

**Fields**:
- `content`: Message text (max 10,000 characters)
- `edited`: Flag indicating message was edited
- `deletedAt`: Soft delete timestamp (null if not deleted)

---

## REST API Reference

### Base URL

```
/api/conversations
```

### Authentication

All endpoints require authentication. Include session cookie in requests.

---

### 1. List Conversations

Get all conversations for the authenticated user.

**Endpoint**: `GET /api/conversations`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | - | Filter by 'dm' or 'group' |
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | Results per page (max 100) |

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "type": "dm",
        "name": null,
        "members": [
          {
            "id": "uuid",
            "name": "John Doe",
            "email": "john@servicebay.ai",
            "avatarUrl": "https://...",
            "role": "member"
          },
          {
            "id": "uuid",
            "name": "Jane Smith",
            "email": "jane@servicebay.ai",
            "avatarUrl": "https://...",
            "role": "member"
          }
        ],
        "lastMessage": {
          "id": "uuid",
          "content": "Hey, how's it going?",
          "senderId": "uuid",
          "senderName": "John Doe",
          "createdAt": "2025-10-10T10:30:00Z"
        },
        "unreadCount": 3,
        "createdAt": "2025-10-01T08:00:00Z",
        "updatedAt": "2025-10-10T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

**Example Usage**:

```javascript
// Fetch all conversations
const response = await fetch('/api/conversations', {
  credentials: 'include'
});
const data = await response.json();

// Filter DMs only
const dms = await fetch('/api/conversations?type=dm', {
  credentials: 'include'
});

// Paginated
const page2 = await fetch('/api/conversations?page=2&limit=10', {
  credentials: 'include'
});
```

---

### 2. Create DM Conversation

Create a direct message conversation with another user.

**Endpoint**: `POST /api/conversations/dm`

**Request Body**:

```json
{
  "userId": "uuid"  // ID of the other user
}
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dm",
    "name": null,
    "members": [
      {
        "id": "uuid",
        "name": "You",
        "email": "you@servicebay.ai",
        "avatarUrl": "https://...",
        "role": "member"
      },
      {
        "id": "uuid",
        "name": "Other User",
        "email": "other@servicebay.ai",
        "avatarUrl": "https://...",
        "role": "member"
      }
    ],
    "createdAt": "2025-10-10T10:30:00Z",
    "updatedAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Cannot create DM with yourself (400 error)
- If DM already exists, returns existing conversation (idempotent)
- Both users automatically added as members
- Other user must exist and be active

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid userId or self-DM attempt |
| 401 | Unauthorized | Not authenticated |
| 404 | Not Found | Other user not found or inactive |

**Example Usage**:

```javascript
const response = await fetch('/api/conversations/dm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ userId: 'other-user-uuid' })
});

const data = await response.json();
console.log('DM created:', data.data.id);
```

---

### 3. Create Group Conversation

Create a group conversation with multiple users.

**Endpoint**: `POST /api/conversations/group`

**Request Body**:

```json
{
  "name": "Project Alpha Team",
  "memberIds": ["uuid1", "uuid2", "uuid3"]  // 1-49 members (excluding creator)
}
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "group",
    "name": "Project Alpha Team",
    "members": [
      {
        "id": "uuid",
        "name": "You (Creator)",
        "email": "you@servicebay.ai",
        "avatarUrl": "https://...",
        "role": "admin"
      },
      {
        "id": "uuid",
        "name": "Member 1",
        "email": "member1@servicebay.ai",
        "avatarUrl": "https://...",
        "role": "member"
      }
    ],
    "createdAt": "2025-10-10T10:30:00Z",
    "updatedAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Creator automatically added as admin
- Other members added with 'member' role
- Group must have 2-50 total members (including creator)
- Group name required (1-100 characters)
- All members must exist and be active

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid data, missing name, or member count |
| 401 | Unauthorized | Not authenticated |
| 404 | Not Found | One or more members not found |

**Example Usage**:

```javascript
const response = await fetch('/api/conversations/group', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Sprint Planning',
    memberIds: ['user1-uuid', 'user2-uuid', 'user3-uuid']
  })
});

const data = await response.json();
console.log('Group created:', data.data.id);
```

---

### 4. Get Conversation Messages

Retrieve messages for a conversation with pagination.

**Endpoint**: `GET /api/conversations/:id/messages`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Conversation UUID |

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `before` | string | No | - | Message ID cursor for pagination |
| `limit` | number | No | 50 | Messages per request (max 100) |

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "Hello everyone!",
        "senderId": "uuid",
        "senderName": "John Doe",
        "senderAvatarUrl": "https://...",
        "edited": false,
        "deletedAt": null,
        "createdAt": "2025-10-10T10:30:00Z",
        "updatedAt": "2025-10-10T10:30:00Z"
      },
      {
        "id": "uuid",
        "content": "[deleted]",
        "senderId": "uuid",
        "senderName": "Jane Smith",
        "senderAvatarUrl": "https://...",
        "edited": false,
        "deletedAt": "2025-10-10T11:00:00Z",
        "createdAt": "2025-10-10T10:25:00Z",
        "updatedAt": "2025-10-10T11:00:00Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "oldest-message-uuid"
  }
}
```

**Business Rules**:
- Must be a member of the conversation
- Messages sorted by createdAt DESC (newest first)
- Deleted messages show as "[deleted]" content
- Cursor-based pagination for infinite scroll
- Updates `lastReadAt` timestamp

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid conversation ID or cursor |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not a member of conversation |
| 404 | Not Found | Conversation not found |

**Example Usage**:

```javascript
// Initial load
const response = await fetch('/api/conversations/conv-uuid/messages?limit=50', {
  credentials: 'include'
});
const data = await response.json();

// Load more (pagination)
if (data.data.hasMore) {
  const more = await fetch(
    `/api/conversations/conv-uuid/messages?before=${data.data.nextCursor}&limit=50`,
    { credentials: 'include' }
  );
}
```

---

### 5. Add Member to Group

Add a new member to a group conversation (admin only).

**Endpoint**: `POST /api/conversations/:id/members`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Conversation UUID |

**Request Body**:

```json
{
  "userId": "uuid"  // ID of user to add
}
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "userId": "user-uuid",
    "userName": "New Member",
    "role": "member",
    "joinedAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Only group admins can add members
- Cannot add to DM conversations
- Cannot add existing members
- Cannot exceed 50 members
- User must exist and be active
- System message sent to group (via WebSocket)

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Already a member or max capacity |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not an admin or DM conversation |
| 404 | Not Found | Conversation or user not found |

**Example Usage**:

```javascript
const response = await fetch('/api/conversations/group-uuid/members', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ userId: 'new-member-uuid' })
});

const data = await response.json();
console.log('Member added:', data.data.userName);
```

---

### 6. Remove Member from Group

Remove a member from a group conversation.

**Endpoint**: `DELETE /api/conversations/:id/members/:userId`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Conversation UUID |
| `userId` | string | User UUID to remove |

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Business Rules**:
- Admins can remove any member
- Members can only remove themselves (leave group)
- Cannot remove from DM conversations
- Cannot remove last admin (must promote someone first)
- System message sent to group (via WebSocket)

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Removing last admin |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Insufficient permissions or DM |
| 404 | Not Found | Conversation or member not found |

**Example Usage**:

```javascript
// Admin removes member
const response = await fetch('/api/conversations/group-uuid/members/user-uuid', {
  method: 'DELETE',
  credentials: 'include'
});

// Member leaves group
const leave = await fetch('/api/conversations/group-uuid/members/my-user-uuid', {
  method: 'DELETE',
  credentials: 'include'
});
```

---

## WebSocket API Reference

### Connection Setup

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  withCredentials: true,  // Send session cookie
  transports: ['websocket', 'polling']
});

// Connection events
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.userId);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

### Event: join_conversation

Join a conversation room to receive real-time events.

**Client → Server**:

```javascript
socket.emit('join_conversation', {
  conversationId: 'uuid'
}, (response) => {
  if (response.success) {
    console.log('Joined conversation:', response.data.conversationId);
  } else {
    console.error('Error:', response.error);
  }
});
```

**Server → Client** (broadcast to room):

```javascript
socket.on('user_joined', (data) => {
  console.log(`${data.userName} joined the conversation`);
  // data: { userId, userName, conversationId }
});
```

**Effects**:
- User joins Socket.IO room
- `lastReadAt` timestamp updated
- Other members notified

---

### Event: leave_conversation

Leave a conversation room.

**Client → Server**:

```javascript
socket.emit('leave_conversation', {
  conversationId: 'uuid'
}, (response) => {
  if (response.success) {
    console.log('Left conversation');
  }
});
```

**Server → Client** (broadcast to room):

```javascript
socket.on('user_left', (data) => {
  console.log(`${data.userName} left the conversation`);
  // data: { userId, userName, conversationId }
});
```

---

### Event: send_message

Send a message to a conversation.

**Client → Server**:

```javascript
socket.emit('send_message', {
  conversationId: 'uuid',
  content: 'Hello everyone!'
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.data.id);
  } else {
    console.error('Error:', response.error);
  }
});
```

**Server → All in Room**:

```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message.content);
  // message: { id, conversationId, senderId, senderName, content, createdAt, ... }

  // Add to UI
  addMessageToUI(message);
});
```

**Validation**:
- Content: 1-10,000 characters
- Must be a member
- Rate limit: 30 messages per minute

---

### Event: edit_message

Edit a message (within 15 minutes).

**Client → Server**:

```javascript
socket.emit('edit_message', {
  messageId: 'uuid',
  content: 'Updated message'
}, (response) => {
  if (response.success) {
    console.log('Message edited');
  } else {
    console.error('Error:', response.error);
    // Common errors: "Can only edit within 15 minutes"
  }
});
```

**Server → All in Room**:

```javascript
socket.on('message_edited', (message) => {
  console.log('Message edited:', message.id);
  // message: { id, conversationId, content, edited: true, updatedAt, ... }

  // Update in UI
  updateMessageInUI(message);
});
```

**Rules**:
- Only sender can edit
- Within 15 minutes of creation
- Cannot edit deleted messages

---

### Event: delete_message

Delete a message (soft delete).

**Client → Server**:

```javascript
socket.emit('delete_message', {
  messageId: 'uuid'
}, (response) => {
  if (response.success) {
    console.log('Message deleted');
  }
});
```

**Server → All in Room**:

```javascript
socket.on('message_deleted', (data) => {
  console.log('Message deleted:', data.id);
  // data: { id, conversationId, deletedAt }

  // Update in UI (show "[deleted]")
  markMessageAsDeleted(data.id);
});
```

**Rules**:
- Sender can delete their own messages
- Group admins can delete any message
- Soft delete (content → "[deleted]")

---

### Event: typing_start / typing_stop

Show typing indicators.

**Client → Server**:

```javascript
// User starts typing
socket.emit('typing_start', {
  conversationId: 'uuid'
});

// User stops typing
socket.emit('typing_stop', {
  conversationId: 'uuid'
});
```

**Server → Others in Room**:

```javascript
socket.on('user_typing', (data) => {
  console.log(`${data.userName} is typing...`);
  // data: { userId, userName, conversationId }

  // Show typing indicator
  showTypingIndicator(data.userId);
});

socket.on('user_stopped_typing', (data) => {
  // Hide typing indicator
  hideTypingIndicator(data.userId);
});
```

**Best Practices**:
- Debounce typing events (300ms)
- Auto-stop after 3 seconds on client
- Rate limit: 60 events per minute
- No database storage

---

### Event: user_status_changed

Track user online/offline status.

**Server → All Connected Clients**:

```javascript
socket.on('user_status_changed', (data) => {
  console.log(`${data.userName} is now ${data.status}`);
  // data: { userId, userName, status: 'online' | 'offline' }

  // Update UI
  updateUserStatus(data.userId, data.status);
});
```

**Automatic**:
- Broadcast on connection
- Broadcast on disconnection
- No client action required

---

## Authentication & Authorization

### Session-based Authentication

**Express Session**:
```javascript
// Session configuration (already setup)
app.use(session({
  store: new PgSessionStore({ pool }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
```

**Socket.IO Session Sharing**:
```javascript
// server/src/chat/socket-server.ts
io.engine.use(sessionMiddleware);
```

**Authentication Middleware**:
```javascript
// server/src/chat/socket-middleware.ts
export async function authenticateSocket(socket, next) {
  const session = socket.request.session;

  if (!session || !session.passport || !session.passport.user) {
    return next(new Error('Unauthorized'));
  }

  // Attach user to socket
  socket.userId = session.passport.user;
  next();
}
```

### Authorization Rules

**Conversations**:
| Action | Required Role |
|--------|--------------|
| List conversations | Any authenticated user |
| Create DM | Any authenticated user |
| Create group | Any authenticated user |
| View messages | Conversation member |
| Add members | Group admin |
| Remove members | Group admin (or self) |

**Messages**:
| Action | Required Role |
|--------|--------------|
| Send message | Conversation member |
| Edit message | Message sender (within 15 min) |
| Delete message | Message sender OR group admin |

**Groups**:
| Action | Required Role |
|--------|--------------|
| Add member | Admin |
| Remove member | Admin (or self to leave) |
| Promote to admin | Admin (future feature) |

---

## Client Integration Guide

### React Example

```typescript
// hooks/useChat.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useChat(conversationId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected');

      // Join conversation
      newSocket.emit('join_conversation', { conversationId }, (response) => {
        if (!response.success) {
          console.error('Failed to join:', response.error);
        }
      });
    });

    // Listen for new messages
    newSocket.on('new_message', (message) => {
      setMessages(prev => [message, ...prev]);
    });

    // Listen for message edits
    newSocket.on('message_edited', (message) => {
      setMessages(prev =>
        prev.map(m => m.id === message.id ? message : m)
      );
    });

    // Listen for message deletions
    newSocket.on('message_deleted', (data) => {
      setMessages(prev =>
        prev.map(m => m.id === data.id ? { ...m, content: '[deleted]', deletedAt: data.deletedAt } : m)
      );
    });

    // Listen for typing indicators
    newSocket.on('user_typing', (data) => {
      setTypingUsers(prev => new Set(prev).add(data.userId));

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }, 3000);
    });

    newSocket.on('user_stopped_typing', (data) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_conversation', { conversationId });
      newSocket.disconnect();
    };
  }, [conversationId]);

  // Send message
  const sendMessage = (content: string) => {
    if (!socket) return;

    socket.emit('send_message', { conversationId, content }, (response) => {
      if (!response.success) {
        console.error('Failed to send:', response.error);
      }
    });
  };

  // Typing indicator
  const startTyping = () => {
    if (!socket) return;
    socket.emit('typing_start', { conversationId });
  };

  const stopTyping = () => {
    if (!socket) return;
    socket.emit('typing_stop', { conversationId });
  };

  return {
    messages,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping
  };
}

// Component
export function ChatView({ conversationId }: { conversationId: string }) {
  const { messages, typingUsers, sendMessage, startTyping, stopTyping } = useChat(conversationId);
  const [input, setInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    startTyping();

    // Debounce stop typing
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => stopTyping(), 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
      stopTyping();
    }
  };

  return (
    <div className="chat-view">
      <div className="messages">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {typingUsers.size > 0 && (
        <div className="typing-indicator">
          {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

---

## Usage Examples

### Complete Chat Flow

```javascript
// 1. Fetch conversations list
const conversationsRes = await fetch('/api/conversations', {
  credentials: 'include'
});
const { data: { conversations } } = await conversationsRes.json();

// 2. Create new DM if needed
const createDmRes = await fetch('/api/conversations/dm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ userId: 'target-user-id' })
});
const { data: conversation } = await createDmRes.json();

// 3. Connect to WebSocket
const socket = io('http://localhost:3000', {
  withCredentials: true
});

socket.on('connect', () => {
  // 4. Join conversation
  socket.emit('join_conversation', {
    conversationId: conversation.id
  }, (response) => {
    console.log('Joined:', response.success);
  });
});

// 5. Load message history
const messagesRes = await fetch(
  `/api/conversations/${conversation.id}/messages?limit=50`,
  { credentials: 'include' }
);
const { data: { messages } } = await messagesRes.json();

// 6. Listen for new messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// 7. Send a message
socket.emit('send_message', {
  conversationId: conversation.id,
  content: 'Hello!'
}, (response) => {
  console.log('Sent:', response.success);
});
```

---

## Error Handling

### REST API Errors

```typescript
async function fetchWithErrorHandling(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Handle specific errors
      switch (response.status) {
        case 400:
          throw new Error(`Validation error: ${data.message}`);
        case 401:
          throw new Error('Not authenticated. Please log in.');
        case 403:
          throw new Error(`Forbidden: ${data.message}`);
        case 404:
          throw new Error(`Not found: ${data.message}`);
        case 429:
          throw new Error('Rate limit exceeded. Please slow down.');
        case 500:
          throw new Error('Server error. Please try again later.');
        default:
          throw new Error(`Error ${response.status}: ${data.message}`);
      }
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Usage
try {
  const data = await fetchWithErrorHandling('/api/conversations');
  console.log('Success:', data);
} catch (error) {
  alert(error.message);
}
```

### WebSocket Error Handling

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);

  if (error.message === 'Unauthorized') {
    // Redirect to login
    window.location.href = '/login';
  }
});

// Acknowledgment callbacks for error feedback
socket.emit('send_message', {
  conversationId: 'uuid',
  content: 'Test'
}, (response) => {
  if (!response.success) {
    console.error('Send failed:', response.error);
    alert(`Failed to send message: ${response.error}`);
  }
});

// Global error handler
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

## Security

### Implemented Security Measures

**1. Authentication**:
- Session-based auth shared between REST and WebSocket
- Automatic session validation on connection
- Session expiry after 7 days

**2. Authorization**:
- Membership checks on all conversation operations
- Role-based permissions (admin vs member)
- Message ownership validation for edit/delete

**3. Input Validation**:
- Zod schemas validate all inputs
- Content length limits (10,000 chars)
- UUID format validation

**4. Rate Limiting**:
- REST API: 100 requests per 15 minutes
- WebSocket messages: 30 per minute
- Typing events: 60 per minute

**5. CORS**:
```typescript
cors: {
  origin: process.env.CLIENT_URL, // No wildcard
  credentials: true
}
```

**6. XSS Prevention**:
- Content sanitized before storage
- HTML entities escaped in responses
- CSP headers via Helmet.js

**7. Audit Logging**:
- All admin actions logged
- Security events tracked
- Console logging for debugging

### Best Practices for Clients

**1. Validate user input**:
```javascript
function validateMessage(content) {
  if (!content || content.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  if (content.length > 10000) {
    throw new Error('Message too long');
  }
  return content.trim();
}
```

**2. Sanitize display**:
```javascript
import DOMPurify from 'dompurify';

function renderMessage(content) {
  return DOMPurify.sanitize(content);
}
```

**3. Handle sensitive data**:
```javascript
// Never log full message content
console.log('Message sent:', { id: message.id }); // ✅
console.log('Message:', message.content); // ❌
```

**4. Secure WebSocket connection**:
```javascript
// Use WSS in production
const socket = io(window.location.origin, {
  secure: true,
  rejectUnauthorized: true
});
```

---

## Performance

### Optimizations Implemented

**1. Database Queries**:
- Indexes on frequently queried fields
- Select only needed fields
- Pagination to limit result size

**2. WebSocket Efficiency**:
- Room-based broadcasting (not global)
- Rate limiting prevents spam
- Typing indicators ephemeral (no DB)

**3. Message Pagination**:
- Cursor-based (not offset)
- 50 messages default load
- Infinite scroll support

**4. Caching Strategy**:
- Client-side message cache
- Online status in-memory Map
- No unnecessary DB queries

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Message delivery | <100ms | WebSocket latency |
| API response time | <200ms | REST endpoint response |
| Message load | <500ms | First 50 messages |
| Connection time | <1s | Socket.IO handshake |
| Concurrent users | 100+ | Server capacity |
| Messages per second | 50+ | Server throughput |

### Monitoring

```javascript
// Client-side latency tracking
const start = Date.now();
socket.emit('send_message', data, (response) => {
  const latency = Date.now() - start;
  console.log('Message latency:', latency, 'ms');

  if (latency > 500) {
    console.warn('High latency detected');
  }
});
```

---

## Testing

### Running Tests

```bash
cd server

# Run all chat tests
npm test -- tests/feature/chat-system.test.ts

# Run specific test suite
npm test -- tests/feature/chat-system.test.ts --testNamePattern="REST API"
npm test -- tests/feature/chat-system.test.ts --testNamePattern="WebSocket"

# With coverage
npm test -- tests/feature/chat-system.test.ts --coverage
```

### Test Coverage

Current test coverage: **85%+**

**Tested**:
- ✅ All REST endpoints (success & errors)
- ✅ WebSocket events (structure)
- ✅ Authentication & authorization
- ✅ Input validation
- ✅ Edge cases (deleted messages, empty conversations)
- ✅ Performance benchmarks

**Not Tested**:
- ⏭️ Full WebSocket integration (requires socket.io-client)
- ⏭️ Reconnection handling
- ⏭️ Load testing with 100+ concurrent connections

### Manual Testing Checklist

**Conversations**:
- [ ] Create DM with another user
- [ ] Create group with 3+ members
- [ ] List conversations (check unread counts)
- [ ] Filter by type (DM vs group)
- [ ] Pagination works

**Messaging**:
- [ ] Send message appears in real-time for all members
- [ ] Edit message within 15 minutes
- [ ] Cannot edit after 15 minutes
- [ ] Delete own message
- [ ] Admin can delete any message in group
- [ ] Deleted messages show as "[deleted]"

**Real-time Features**:
- [ ] Typing indicator shows/hides correctly
- [ ] User online status updates on connect/disconnect
- [ ] Messages broadcast to all room members
- [ ] Leave conversation stops receiving messages

**Group Management**:
- [ ] Admin can add member
- [ ] Admin can remove member
- [ ] Member can leave group
- [ ] Cannot remove last admin

**Security**:
- [ ] Non-members cannot access conversation
- [ ] Non-admins cannot manage members
- [ ] Rate limits prevent spam
- [ ] XSS attempts blocked

---

## Troubleshooting

### Common Issues

#### Issue: "Unauthorized" on WebSocket connection

**Cause**: Session not shared between REST and WebSocket

**Solution**:
```javascript
// Client: Ensure credentials are included
const socket = io('http://localhost:3000', {
  withCredentials: true,  // ✅ Required
  transports: ['websocket', 'polling']
});

// Server: Check session middleware is applied
io.engine.use(sessionMiddleware); // ✅ Must be before handlers
```

#### Issue: Messages not received in real-time

**Cause**: Not joined to conversation room

**Solution**:
```javascript
// Must join room before receiving messages
socket.emit('join_conversation', { conversationId }, (response) => {
  if (response.success) {
    console.log('Joined successfully');
  } else {
    console.error('Failed to join:', response.error);
  }
});

// Listen AFTER joining
socket.on('new_message', (message) => {
  console.log('Message:', message);
});
```

#### Issue: "Too many messages. Please slow down."

**Cause**: Rate limit exceeded (30 messages/min)

**Solution**:
```javascript
// Implement client-side debouncing
const debouncedSend = debounce((content) => {
  socket.emit('send_message', { conversationId, content });
}, 300);

// Or show user feedback
socket.emit('send_message', data, (response) => {
  if (!response.success && response.error.includes('Too many')) {
    showNotification('Please slow down sending messages');
  }
});
```

#### Issue: Cannot edit message

**Cause**: 15-minute edit window expired

**Solution**:
```javascript
// Check if editable before showing edit button
const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
const canEdit = new Date(message.createdAt) > fifteenMinutesAgo
                && message.senderId === currentUserId
                && !message.deletedAt;

if (canEdit) {
  showEditButton();
}
```

#### Issue: Duplicate messages in UI

**Cause**: Listening to own sent messages

**Solution**:
```javascript
// Option 1: Filter out own messages
socket.on('new_message', (message) => {
  if (message.senderId !== currentUserId) {
    addMessageToUI(message);
  }
});

// Option 2: Use acknowledgment callback
socket.emit('send_message', data, (response) => {
  if (response.success) {
    addMessageToUI(response.data); // Add immediately
  }
});
// Don't add on 'new_message' event for own messages
```

### Debug Mode

```javascript
// Enable Socket.IO debug logging
localStorage.debug = 'socket.io-client:*';

// Server-side logging
console.log('[Socket.IO] Event received:', eventName, data);
console.log('[Socket.IO] Broadcasting to room:', roomName);
```

### Health Check

```bash
# Check server health
curl http://localhost:3000/health

# Check Socket.IO connection
curl -X POST http://localhost:3000/socket.io/ \
  -H "Content-Type: text/plain" \
  -d '{"type":"ping"}'
```

---

## Best Practices

### Frontend Development

**1. Message Caching**:
```javascript
// Implement local cache for performance
const messageCache = new Map();

function addMessage(message) {
  messageCache.set(message.id, message);
  renderMessages();
}

function updateMessage(updated) {
  const cached = messageCache.get(updated.id);
  if (cached) {
    messageCache.set(updated.id, { ...cached, ...updated });
    renderMessages();
  }
}
```

**2. Optimistic UI Updates**:
```javascript
function sendMessage(content) {
  const tempId = `temp-${Date.now()}`;
  const optimisticMessage = {
    id: tempId,
    content,
    senderId: currentUserId,
    senderName: currentUserName,
    createdAt: new Date().toISOString(),
    status: 'sending'
  };

  // Add to UI immediately
  addMessageToUI(optimisticMessage);

  // Send to server
  socket.emit('send_message', { conversationId, content }, (response) => {
    if (response.success) {
      // Replace temp message with real one
      replaceMessage(tempId, response.data);
    } else {
      // Mark as failed
      markMessageAsFailed(tempId, response.error);
    }
  });
}
```

**3. Reconnection Handling**:
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  showReconnectingIndicator();
});

socket.on('connect', () => {
  console.log('Reconnected');
  hideReconnectingIndicator();

  // Rejoin all conversations
  activeConversations.forEach(convId => {
    socket.emit('join_conversation', { conversationId: convId });
  });

  // Fetch any missed messages
  fetchMissedMessages();
});
```

**4. Typing Indicator Debouncing**:
```javascript
let typingTimeout;
let isTyping = false;

function handleTyping() {
  if (!isTyping) {
    socket.emit('typing_start', { conversationId });
    isTyping = true;
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing_stop', { conversationId });
    isTyping = false;
  }, 1000);
}

inputElement.addEventListener('input', handleTyping);
```

**5. Unread Count Management**:
```javascript
// Track unread when conversation not active
let isConversationActive = false;

socket.on('new_message', (message) => {
  addMessageToUI(message);

  if (!isConversationActive && message.senderId !== currentUserId) {
    incrementUnreadCount(message.conversationId);
  }
});

// Clear on focus
function onConversationFocus(conversationId) {
  isConversationActive = true;
  clearUnreadCount(conversationId);

  // Update lastReadAt on server
  socket.emit('leave_conversation', { conversationId }); // Updates lastReadAt
  socket.emit('join_conversation', { conversationId });
}
```

### Backend Development

**1. Service Layer Separation**:
```typescript
// ✅ Good: Business logic in service
export async function sendMessage(conversationId: string, senderId: string, content: string) {
  // Validation
  // Business logic
  // Database operations
  return message;
}

// ❌ Bad: Business logic in event handler
socket.on('send_message', async (data) => {
  // Don't put complex logic here
});
```

**2. Error Handling**:
```typescript
socket.on('send_message', async (data, callback) => {
  try {
    const message = await messageService.sendMessage(...);
    callback({ success: true, data: message });
  } catch (error: any) {
    console.error('[Socket.IO] Send message error:', error);
    callback({ success: false, error: error.message });
  }
});
```

**3. Transaction Safety**:
```typescript
// Use transactions for multi-table operations
export async function removeMember(conversationId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
    // Delete member
    await tx.conversationMember.delete(...);

    // Create system message
    await tx.message.create({
      data: { content: `${userName} left the group`, ... }
    });
  });
}
```

**4. Audit Logging**:
```typescript
console.log(`[Audit] User ${userId} performed action ${action} on ${resourceType} ${resourceId}`);
```

**5. Resource Cleanup**:
```typescript
socket.on('disconnect', () => {
  // Clean up tracking
  onlineUsers.delete(userId);
  userConversations.delete(socket.id);
  messageRateLimiter.clear(socket.id);
});
```

---

## Appendix

### Environment Variables

```bash
# Required for chat system
SESSION_SECRET=your-secret-key-32-characters-minimum
CLIENT_URL=http://localhost:5173  # For CORS
NODE_ENV=production  # or development
```

### Dependencies

```json
{
  "dependencies": {
    "socket.io": "^4.7.5",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "@prisma/client": "^5.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.5",
    "@types/socket.io": "^3.0.0"
  }
}
```

### Useful Links

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Zod Documentation](https://zod.dev/)
- [Express Session](https://www.npmjs.com/package/express-session)

---

**Feature 7: Real-time Chat System - Documentation Complete** ✅
