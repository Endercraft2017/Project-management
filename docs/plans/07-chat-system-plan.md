# Feature 7: Real-time Chat System - Implementation Plan

**Status**: Ready for Implementation
**Estimated Time**: 5 hours
**Dependencies**: Features 1-2 (Database, Authentication)
**Last Updated**: 2025-10-10

---

## Table of Contents

1. [Research Summary](#research-summary)
2. [Feature Overview](#feature-overview)
3. [Architecture Design](#architecture-design)
4. [Database Schema](#database-schema)
5. [REST API Endpoints](#rest-api-endpoints)
6. [WebSocket Events](#websocket-events)
7. [Implementation Plan](#implementation-plan)
8. [Security Considerations](#security-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)

---

## Research Summary

### Socket.IO Best Practices (2025)

**Key Findings**:

1. **TypeScript Support**: Socket.IO v4+ has first-class TypeScript support with typed events
2. **Authentication**: Middleware-based authentication using handshake auth tokens
3. **Session Sharing**: Share Express session with Socket.IO via `socket.request.session`
4. **Scalability**: Redis adapter for horizontal scaling across multiple server instances
5. **Security**: CORS must be explicitly configured (no wildcard in production)
6. **Rooms**: Backend-controlled rooms for secure group management
7. **Namespaces**: Separate communication channels with independent middleware
8. **Error Handling**: Acknowledgment callbacks for error feedback
9. **Singleton Pattern**: Single Socket.IO server instance shared across modules
10. **Separation of Concerns**: Business logic in service files, not socket handlers

### Architecture Patterns

**MVC Pattern**: Apply Model-View-Controller to keep Socket.IO organized
**Singleton Design**: Single Socket.IO server instance accessible throughout app
**Middleware Stack**: Authentication → Authorization → Rate Limiting → Event Handlers

### Scalability Considerations

For this project (15 developers):
- **Single Server**: Sufficient for ~100 concurrent users
- **Future**: Redis adapter ready for horizontal scaling if needed
- **Sticky Sessions**: Required for load balancing (Railway handles this)

---

## Feature Overview

### User Stories

1. **As a team member**, I want to send direct messages to other team members
2. **As a team member**, I want to create group conversations for projects
3. **As an admin**, I want to add/remove members from group conversations
4. **As a team member**, I want to see who is online/offline
5. **As a team member**, I want to see typing indicators
6. **As a team member**, I want to edit/delete my messages
7. **As a team member**, I want to react to messages with emojis
8. **As a team member**, I want to receive real-time notifications

### Core Functionality

**REST API**:
- List conversations (with last message preview)
- Create DM conversation
- Create group conversation
- Get conversation messages (paginated)
- Add/remove members (admin only for groups)

**WebSocket Events**:
- Join/leave conversation rooms
- Send/edit/delete messages
- Typing indicators (start/stop)
- User online/offline status
- Message reactions

---

## Architecture Design

### File Structure

```
server/src/chat/
├── socket-server.ts       # Socket.IO server singleton
├── socket-handlers.ts     # WebSocket event handlers
├── socket-middleware.ts   # Socket authentication middleware
├── conversation-service.ts # Conversation business logic
├── message-service.ts     # Message business logic
├── controller.ts          # REST API controllers
├── routes.ts              # REST API routes
└── validators.ts          # Zod validation schemas
```

### Technology Stack

- **Socket.IO v4**: WebSocket server with fallback to long polling
- **Express Session**: Shared session between REST and WebSocket
- **Prisma**: Database ORM (models already exist)
- **Zod**: Input validation for both REST and WebSocket events

### Data Flow

```
Client -> Socket.IO -> Middleware (Auth) -> Event Handler -> Service -> Database
                                                          -> Emit to Room/User
```

---

## Database Schema

### Existing Models (Already in schema.prisma)

```prisma
model Conversation {
  id          String   @id @default(uuid())
  type        String   // 'dm' or 'group'
  name        String?  // For group conversations
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdBy User                   @relation("CreatedConversations", fields: [createdById], references: [id], onDelete: Restrict)
  members   ConversationMember[]
  messages  Message[]

  @@index([createdById])
  @@index([type])
  @@map("conversations")
}

model ConversationMember {
  id             String   @id @default(uuid())
  conversationId String
  userId         String
  role           String   // 'admin' or 'member'
  joinedAt       DateTime @default(now())
  lastReadAt     DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId])
  @@map("conversation_members")
}

model Message {
  id             String    @id @default(uuid())
  conversationId String
  senderId       String
  content        String    @db.Text
  edited         Boolean   @default(false)
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id], onDelete: Restrict)

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
  @@map("messages")
}
```

**No schema changes needed!** All models already exist.

---

## REST API Endpoints

### 1. List Conversations

```
GET /api/conversations
```

**Query Parameters**:
- `type` (optional): Filter by 'dm' or 'group'
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response**:
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
          {"id": "uuid", "name": "John Doe", "email": "john@servicebay.ai", "role": "member"}
        ],
        "lastMessage": {
          "id": "uuid",
          "content": "Hey, how's it going?",
          "senderId": "uuid",
          "senderName": "John Doe",
          "createdAt": "2025-10-10T10:30:00Z"
        },
        "unreadCount": 3,
        "createdAt": "2025-10-01T08:00:00Z"
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

### 2. Create DM Conversation

```
POST /api/conversations/dm
```

**Request Body**:
```json
{
  "userId": "uuid"  // Other user ID
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dm",
    "name": null,
    "members": [...],
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Cannot create DM with self
- If DM already exists between two users, return existing conversation
- Both users automatically added as members with 'member' role

### 3. Create Group Conversation

```
POST /api/conversations/group
```

**Request Body**:
```json
{
  "name": "Project Alpha Team",
  "memberIds": ["uuid1", "uuid2", "uuid3"]  // 2-50 members
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "group",
    "name": "Project Alpha Team",
    "members": [...],
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Creator automatically added as 'admin'
- Other members added with 'member' role
- Group must have 2-50 members (including creator)
- Group name required (1-100 characters)

### 4. Get Conversation Messages

```
GET /api/conversations/:id/messages
```

**Query Parameters**:
- `before` (optional): Cursor for pagination (message ID)
- `limit` (default: 50, max: 100)

**Response**:
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
        "edited": false,
        "deletedAt": null,
        "createdAt": "2025-10-10T10:30:00Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "uuid"
  }
}
```

**Business Rules**:
- Must be a member of the conversation
- Deleted messages show as "[deleted]" content
- Cursor-based pagination (newest first)

### 5. Add Member to Group

```
POST /api/conversations/:id/members
```

**Request Body**:
```json
{
  "userId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "role": "member",
    "joinedAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Only group admins can add members
- Cannot add existing member
- Cannot exceed 50 members
- System message sent to group

### 6. Remove Member from Group

```
DELETE /api/conversations/:id/members/:userId
```

**Response**:
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Business Rules**:
- Only group admins can remove others
- Members can remove themselves (leave group)
- Cannot remove last admin
- System message sent to group

---

## WebSocket Events

### Connection & Authentication

```typescript
// Client connects
socket.emit('authenticate', { token: 'session-id' });

// Server response
socket.emit('authenticated', { userId: 'uuid', name: 'John Doe' });
socket.emit('auth_error', { message: 'Unauthorized' });
```

**Middleware**: Check `socket.request.session` for authenticated user

### Event: join_conversation

```typescript
// Client -> Server
socket.emit('join_conversation', { conversationId: 'uuid' });

// Server -> Client
socket.emit('conversation_joined', { conversationId: 'uuid' });
socket.emit('error', { message: 'Not a member of this conversation' });
```

**Business Logic**:
- Verify user is a member
- Join Socket.IO room `conversation:${conversationId}`
- Update user's online status in conversation

### Event: leave_conversation

```typescript
// Client -> Server
socket.emit('leave_conversation', { conversationId: 'uuid' });

// Server -> Client
socket.emit('conversation_left', { conversationId: 'uuid' });
```

**Business Logic**:
- Leave Socket.IO room
- Update lastReadAt timestamp
- Update user's offline status

### Event: send_message

```typescript
// Client -> Server
socket.emit('send_message', {
  conversationId: 'uuid',
  content: 'Hello everyone!'
}, (response) => {
  // Acknowledgment callback
  if (response.success) {
    console.log('Message sent', response.data);
  } else {
    console.error('Error', response.error);
  }
});

// Server -> All in Room
socket.to(`conversation:${conversationId}`).emit('new_message', {
  id: 'uuid',
  conversationId: 'uuid',
  senderId: 'uuid',
  senderName: 'John Doe',
  content: 'Hello everyone!',
  createdAt: '2025-10-10T10:30:00Z'
});
```

**Business Logic**:
- Verify user is a member
- Validate content (1-10,000 characters)
- Save to database
- Broadcast to all room members except sender
- Send acknowledgment to sender

### Event: edit_message

```typescript
// Client -> Server
socket.emit('edit_message', {
  messageId: 'uuid',
  content: 'Updated message'
}, (response) => { /* ack */ });

// Server -> All in Room
socket.to(`conversation:${conversationId}`).emit('message_edited', {
  id: 'uuid',
  conversationId: 'uuid',
  content: 'Updated message',
  edited: true,
  updatedAt: '2025-10-10T10:31:00Z'
});
```

**Business Logic**:
- Verify user is the message sender
- Only allow edits within 15 minutes
- Set edited flag
- Broadcast to all room members

### Event: delete_message

```typescript
// Client -> Server
socket.emit('delete_message', {
  messageId: 'uuid'
}, (response) => { /* ack */ });

// Server -> All in Room
socket.to(`conversation:${conversationId}`).emit('message_deleted', {
  id: 'uuid',
  conversationId: 'uuid',
  deletedAt: '2025-10-10T10:32:00Z'
});
```

**Business Logic**:
- Verify user is the message sender or group admin
- Soft delete (set deletedAt)
- Broadcast to all room members

### Event: typing_start / typing_stop

```typescript
// Client -> Server
socket.emit('typing_start', { conversationId: 'uuid' });
socket.emit('typing_stop', { conversationId: 'uuid' });

// Server -> All in Room (except sender)
socket.to(`conversation:${conversationId}`).emit('user_typing', {
  userId: 'uuid',
  userName: 'John Doe',
  conversationId: 'uuid'
});

socket.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
  userId: 'uuid',
  conversationId: 'uuid'
});
```

**Business Logic**:
- No database storage
- Broadcast to room members only
- Auto-timeout after 3 seconds on client

### Event: message_reaction

```typescript
// Client -> Server
socket.emit('message_reaction', {
  messageId: 'uuid',
  emoji: '👍'
}, (response) => { /* ack */ });

// Server -> All in Room
socket.to(`conversation:${conversationId}`).emit('reaction_added', {
  messageId: 'uuid',
  userId: 'uuid',
  userName: 'John Doe',
  emoji: '👍'
});
```

**Business Logic**:
- Store in database (future: reactions table)
- For MVP: Store in JSON field or skip storage
- Broadcast to all room members

### User Online/Offline Status

```typescript
// Server tracks connected users
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

// On connect
socket.on('user_online', () => {
  // Broadcast to all relevant conversations
  socket.broadcast.emit('user_status_changed', {
    userId: 'uuid',
    status: 'online'
  });
});

// On disconnect
socket.on('disconnect', () => {
  socket.broadcast.emit('user_status_changed', {
    userId: 'uuid',
    status: 'offline'
  });
});
```

---

## Implementation Plan

### Step 1: Validation Schemas (30 min)

**File**: `server/src/chat/validators.ts`

Create Zod schemas for:
- `createDmSchema` (userId)
- `createGroupSchema` (name, memberIds)
- `getConversationsQuerySchema` (type, page, limit)
- `getMessagesQuerySchema` (before, limit)
- `addMemberSchema` (userId)
- `sendMessageSchema` (conversationId, content)
- `editMessageSchema` (messageId, content)
- `deleteMessageSchema` (messageId)
- `joinConversationSchema` (conversationId)
- `typingEventSchema` (conversationId)

### Step 2: Services (90 min)

**File**: `server/src/chat/conversation-service.ts`

Methods:
- `listConversations(userId, filters, pagination)`
- `getConversationById(id, userId)`
- `createDmConversation(userId1, userId2)`
- `createGroupConversation(creatorId, name, memberIds)`
- `addMember(conversationId, userId, addedBy)`
- `removeMember(conversationId, userId, removedBy)`
- `getConversationMessages(conversationId, userId, cursor, limit)`
- `updateLastReadAt(conversationId, userId)`

**File**: `server/src/chat/message-service.ts`

Methods:
- `sendMessage(conversationId, senderId, content)`
- `editMessage(messageId, userId, content)`
- `deleteMessage(messageId, userId)`
- `getMessageById(id)`

### Step 3: Socket.IO Server Setup (45 min)

**File**: `server/src/chat/socket-server.ts`

```typescript
import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { sessionMiddleware } from '@/middlewares/session';

let io: SocketServer;

export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Share Express session with Socket.IO
  io.engine.use(sessionMiddleware);

  return io;
}

export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
}
```

### Step 4: Socket Middleware (30 min)

**File**: `server/src/chat/socket-middleware.ts`

```typescript
import { Socket } from 'socket.io';

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const session = (socket.request as any).session;

    if (!session || !session.passport || !session.passport.user) {
      return next(new Error('Unauthorized'));
    }

    // Attach user to socket
    (socket as any).userId = session.passport.user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
}
```

### Step 5: Socket Event Handlers (90 min)

**File**: `server/src/chat/socket-handlers.ts`

Implement handlers for all events listed in WebSocket Events section.

```typescript
import { Server as SocketServer, Socket } from 'socket.io';
import { ConversationService } from './conversation-service';
import { MessageService } from './message-service';

export function registerSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;

    // Event: join_conversation
    socket.on('join_conversation', async (data, callback) => {
      // Implementation
    });

    // Event: send_message
    socket.on('send_message', async (data, callback) => {
      // Implementation
    });

    // ... other events
  });
}
```

### Step 6: REST API Controllers (45 min)

**File**: `server/src/chat/controller.ts`

Implement controllers for all REST endpoints.

### Step 7: REST API Routes (15 min)

**File**: `server/src/chat/routes.ts`

```typescript
import { Router } from 'express';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import * as chatController from './controller';

const router = Router();

router.get('/conversations', isAuthenticated, chatController.listConversations);
router.post('/conversations/dm', isAuthenticated, chatController.createDm);
router.post('/conversations/group', isAuthenticated, chatController.createGroup);
router.get('/conversations/:id/messages', isAuthenticated, chatController.getMessages);
router.post('/conversations/:id/members', isAuthenticated, chatController.addMember);
router.delete('/conversations/:id/members/:userId', isAuthenticated, chatController.removeMember);

export default router;
```

### Step 8: Update Server Entry Point (15 min)

**File**: `server/src/server.ts`

```typescript
import http from 'http';
import app from './app';
import { initializeSocketServer } from './chat/socket-server';
import { registerSocketHandlers } from './chat/socket-handlers';
import { authenticateSocket } from './chat/socket-middleware';

const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocketServer(server);

// Socket middleware
io.use(authenticateSocket);

// Register event handlers
registerSocketHandlers(io);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 9: Update App Routes (5 min)

**File**: `server/src/app.ts`

```typescript
import chatRoutes from './chat/routes';

// Add after existing routes
app.use('/api/conversations', chatRoutes);
```

---

## Security Considerations

### 1. Authentication

- **WebSocket**: Verify session on connection, reject if not authenticated
- **REST API**: Use `isAuthenticated` middleware on all endpoints
- **Event Handlers**: Check user membership before any operation

### 2. Authorization

**Conversations**:
- Only members can view/send messages
- Only admins can add/remove members in groups
- Only message sender can edit/delete their own messages

**Input Validation**:
- Zod schemas for all inputs
- Content length limits (10,000 characters)
- XSS prevention via sanitization

### 3. Rate Limiting

```typescript
const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: 'Too many messages, please slow down',
});
```

Apply to socket events and REST endpoints.

### 4. CORS Configuration

```typescript
cors: {
  origin: process.env.CLIENT_URL, // No wildcard
  credentials: true,
}
```

### 5. Data Sanitization

- Sanitize message content to prevent XSS
- Escape HTML entities
- Strip malicious scripts

### 6. Audit Logging

Log security-relevant events:
- Failed authentication attempts
- Member additions/removals
- Message deletions by admins

---

## Testing Strategy

### Unit Tests

**conversation-service.test.ts**:
- Test createDmConversation (success, duplicate, self)
- Test createGroupConversation (success, invalid members, name validation)
- Test addMember (success, non-admin, duplicate, max members)
- Test removeMember (success, last admin, non-member)

**message-service.test.ts**:
- Test sendMessage (success, invalid conversation, content validation)
- Test editMessage (success, wrong sender, timeout)
- Test deleteMessage (success, wrong sender, admin override)

### Integration Tests

**File**: `tests/feature/chat-system.test.ts`

**Test Suites**:

1. **REST API - Conversations**
   - List conversations (pagination, filtering)
   - Create DM (success, duplicate, self)
   - Create group (success, invalid data)
   - Get messages (success, not member, pagination)
   - Add/remove members (success, authorization)

2. **WebSocket - Connection**
   - Connect with valid session
   - Connect with invalid session (should fail)
   - Disconnect handling

3. **WebSocket - Messaging**
   - Join conversation (success, not member)
   - Send message (success, not member, validation)
   - Edit message (success, wrong sender, timeout)
   - Delete message (success, wrong sender, admin)

4. **WebSocket - Real-time Events**
   - Typing indicators
   - User online/offline status
   - Message reactions

5. **Authorization Tests**
   - Non-member access attempts
   - Member vs admin permissions
   - Message ownership checks

6. **Edge Cases**
   - Empty conversations
   - Deleted messages
   - Long content
   - Concurrent operations

### CI/CD Tests

**File**: `tests/CI_CD/chat-system-ci.yml`

**Jobs**:
1. `test-chat-rest-api` - REST endpoint tests
2. `test-chat-websocket` - Socket.IO tests
3. `test-chat-services` - Unit tests for services
4. `test-chat-authorization` - Permission tests
5. `integration-test` - Full integration tests
6. `security-validation` - XSS, injection tests
7. `code-quality` - ESLint, Prettier
8. `performance-test` - Load test with 50 concurrent connections
9. `realtime-latency-test` - Message delivery speed
10. `connection-stability-test` - Reconnection handling

---

## Performance Considerations

### 1. Message Pagination

- Cursor-based pagination for infinite scroll
- Limit: 50 messages per request (max 100)
- Index on `createdAt` for fast queries

### 2. Typing Indicators

- No database storage
- Debounced on client (300ms)
- Auto-timeout after 3 seconds

### 3. Online Status

- In-memory Map for tracking
- Emit only to relevant conversations
- Graceful handling of disconnections

### 4. Database Queries

**Optimize with includes**:
```typescript
prisma.conversation.findMany({
  include: {
    members: {
      include: { user: true }
    },
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' }
    }
  }
})
```

**Use select to limit fields**:
```typescript
select: {
  id: true,
  name: true,
  email: true
}
```

### 5. Scalability

**Current**: Single server (sufficient for 15 users)

**Future** (if needed):
- Redis adapter for Socket.IO clustering
- Sticky sessions for load balancing
- Separate WebSocket and REST servers

### 6. Connection Limits

- Max 100 concurrent connections per user (prevent abuse)
- Max 1,000 total connections (Railway default)
- Monitor and alert on high usage

---

## Deliverables Checklist

### Code Files
- [ ] `server/src/chat/validators.ts`
- [ ] `server/src/chat/conversation-service.ts`
- [ ] `server/src/chat/message-service.ts`
- [ ] `server/src/chat/socket-server.ts`
- [ ] `server/src/chat/socket-middleware.ts`
- [ ] `server/src/chat/socket-handlers.ts`
- [ ] `server/src/chat/controller.ts`
- [ ] `server/src/chat/routes.ts`
- [ ] `server/src/server.ts` (updated)
- [ ] `server/src/app.ts` (updated)

### Tests
- [ ] `tests/feature/chat-system.test.ts`
- [ ] `tests/CI_CD/chat-system-ci.yml`

### Documentation
- [ ] `docs/plans/07-chat-system-plan.md` (this file)
- [ ] `docs/documentation/07-chat-system.md`

### Status Updates
- [ ] Update `IMPLEMENTATION_STATUS.md`
- [ ] Update `README.md`

---

## Timeline

| Task | Estimated Time |
|------|---------------|
| Validators | 30 min |
| Services | 90 min |
| Socket.IO Server | 45 min |
| Socket Middleware | 30 min |
| Socket Handlers | 90 min |
| REST Controllers | 45 min |
| REST Routes | 15 min |
| Server Integration | 20 min |
| Tests | 60 min |
| CI/CD | 30 min |
| Documentation | 45 min |
| **Total** | **~8 hours** |

---

## Success Criteria

- [ ] All REST endpoints working with proper authorization
- [ ] WebSocket events functioning correctly
- [ ] Real-time message delivery with <100ms latency
- [ ] Typing indicators and online status working
- [ ] All tests passing (>90% coverage)
- [ ] CI/CD pipeline green
- [ ] Documentation complete with examples
- [ ] No security vulnerabilities
- [ ] Performance meets requirements (50+ concurrent users)

---

## Notes

- Database schema already complete (no migrations needed)
- Session sharing between Express and Socket.IO is crucial
- Use acknowledgment callbacks for all Socket events (error feedback)
- Implement soft delete for messages (privacy/compliance)
- Keep typing indicators ephemeral (no DB storage)
- Rate limit socket events to prevent spam/abuse

---

**Ready to implement!** 🚀
