# API Call Pipeline Documentation

**Last Updated:** 2025-10-23
**Version:** 1.0

## Table of Contents

- [Overview](#overview)
- [Request Flow](#request-flow)
- [Middleware Pipeline](#middleware-pipeline)
- [Authentication Flow](#authentication-flow)
- [Authorization Flow](#authorization-flow)
- [Validation Pipeline](#validation-pipeline)
- [Error Handling Pipeline](#error-handling-pipeline)
- [Response Format](#response-format)
- [Real-time Event Pipeline](#real-time-event-pipeline)
- [Weekly Summary Generation Pipeline](#weekly-summary-generation-pipeline)
- [Examples](#examples)

## Overview

This document describes the complete pipeline that every API call goes through in the ServiceBay PM application, from the moment a request hits the server to when the response is sent back to the client.

## Request Flow

### High-Level Flow

```
Client Request
    ↓
Express Router
    ↓
Middleware Pipeline
    ↓
Route Handler (Controller)
    ↓
Service Layer
    ↓
Prisma ORM
    ↓
PostgreSQL Database
    ↓
Response Formation
    ↓
Client Response
```

### Detailed Flow with Timing

```
[0ms] Client sends HTTP request
[0ms] ├─ Express receives request
[1ms] ├─ CORS middleware validates origin
[2ms] ├─ Body parser middleware parses JSON
[3ms] ├─ Authentication middleware validates JWT
[5ms] ├─ Authorization middleware checks role
[6ms] ├─ Route handler invoked (Controller)
[7ms] │  └─ Request validation (Zod schema)
[10ms] ├─ Service layer processes business logic
[15ms] │  └─ Database query executed (Prisma)
[50ms] ├─ Database returns results
[55ms] ├─ Service formats response data
[56ms] ├─ Controller sends JSON response
[57ms] └─ Response sent to client
```

## Middleware Pipeline

### Execution Order

All middleware is applied in the order listed below:

```typescript
// server/src/index.ts

app.use(cors(corsOptions));              // 1. CORS
app.use(express.json({ limit: '50mb' })); // 2. Body Parser
app.use(express.urlencoded({ extended: true })); // 3. URL Parser

// Route-specific middleware applied per route:
// - requireAuth (authentication)
// - requireAdmin (authorization)
```

### 1. CORS Middleware

**Purpose:** Validate request origin and handle preflight requests

**Location:** `server/src/index.ts`

**Configuration:**
```typescript
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

**Flow:**
```
Request arrives
    ↓
Check Origin header
    ↓
Origin matches CLIENT_URL?
    ├─ Yes → Allow request, add CORS headers
    └─ No → Reject request (403)
```

### 2. Body Parser Middleware

**Purpose:** Parse JSON request bodies

**Limits:** 50MB maximum body size (for file uploads)

**Flow:**
```
Request with Content-Type: application/json
    ↓
Parse JSON body
    ├─ Valid JSON → Set req.body
    └─ Invalid JSON → 400 error
```

### 3. Authentication Middleware (requireAuth)

**Purpose:** Validate JWT tokens and identify users

**Location:** `server/src/middleware/auth.ts`

**Flow:**
```typescript
Request arrives at protected endpoint
    ↓
Extract Authorization header
    ↓
Header exists?
    ├─ No → 401 Unauthorized
    └─ Yes → Continue
        ↓
Parse Bearer token
    ↓
JWT valid?
    ├─ No → 401 Unauthorized
    └─ Yes → Continue
        ↓
Decode JWT payload
    ↓
Extract userId from payload
    ↓
Query database for user
    ↓
User exists and active?
    ├─ No → 401 Unauthorized
    └─ Yes → Continue
        ↓
Attach user to req.user
    ↓
Call next()
```

**Implementation:**
```typescript
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 4. Authorization Middleware (requireAdmin)

**Purpose:** Ensure user has admin role

**Location:** `server/src/middleware/auth.ts`

**Prerequisite:** Must be used AFTER `requireAuth`

**Flow:**
```typescript
Request arrives at admin-only endpoint
    ↓
req.user exists? (from requireAuth)
    ├─ No → 401 Unauthorized (shouldn't happen)
    └─ Yes → Continue
        ↓
req.user.role === 'ADMIN'?
    ├─ No → 403 Forbidden
    └─ Yes → Continue
        ↓
Call next()
```

**Implementation:**
```typescript
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }
  next();
};
```

## Authentication Flow

### Login Flow (Google OAuth)

```
1. Client: GET /api/auth/google
    ↓
2. Server: Redirect to Google OAuth consent
    ↓
3. User: Approves permissions on Google
    ↓
4. Google: Redirects to /api/auth/google/callback?code=...
    ↓
5. Server:
   ├─ Exchange code for tokens
   ├─ Fetch user profile from Google
   ├─ Create/update user in database
   ├─ Generate JWT access token (15 min)
   ├─ Generate refresh token (7 days)
   └─ Redirect to CLIENT_URL with tokens
    ↓
6. Client: Store tokens in localStorage
```

### Authenticated Request Flow

```
1. Client: Add Authorization header
   Authorization: Bearer <access_token>
    ↓
2. Server: requireAuth middleware
   ├─ Extract token
   ├─ Verify JWT signature
   ├─ Check expiration
   ├─ Load user from database
   └─ Attach to req.user
    ↓
3. Route handler: Access req.user
```

### Token Refresh Flow

```
1. Client: Access token expired (401 error)
    ↓
2. Client: POST /api/auth/refresh
   Body: { refreshToken: <refresh_token> }
    ↓
3. Server:
   ├─ Verify refresh token
   ├─ Check not revoked
   ├─ Generate new access token
   └─ Return new tokens
    ↓
4. Client: Store new tokens
    ↓
5. Client: Retry original request
```

## Authorization Flow

### Role-Based Access Control (RBAC)

**Roles:**
- `ADMIN` - Full access (sprint management, user management, summaries)
- `MEMBER` - Standard access (tasks, chat, daily updates)

**Permission Matrix:**

| Feature | ADMIN | MEMBER |
|---------|-------|--------|
| View tasks | ✅ | ✅ |
| Create/edit tasks | ✅ | ✅ |
| Create sprints | ✅ | ❌ |
| Manage sprints | ✅ | ❌ |
| Send invites | ✅ | ❌ |
| Generate summaries | ✅ | ❌ |
| Send summary emails | ✅ | ❌ |
| Configure email settings | ✅ | ❌ |
| View summaries | ✅ | ✅ |
| Chat messaging | ✅ | ✅ |
| Daily updates | ✅ | ✅ |

**Implementation:**
```typescript
// Admin-only route
router.post('/api/summaries/generate',
  requireAuth,    // Authenticate first
  requireAdmin,   // Then check role
  controller.generate
);

// Authenticated route (any user)
router.get('/api/summaries/:weekDate',
  requireAuth,    // Only authentication required
  controller.getByWeek
);
```

## Validation Pipeline

### Request Validation (Zod)

**Purpose:** Validate request data before processing

**Location:** Validation schemas in `*/validators.ts` files

**Flow:**
```typescript
Controller receives request
    ↓
Parse request data with Zod schema
    ↓
Validation successful?
    ├─ No → Return 400 with error details
    └─ Yes → Continue to business logic
```

### Example: Generate Weekly Summary

**Schema Definition:**
```typescript
// server/src/summaries/validators.ts
import { z } from 'zod';

export const generateWeeklySummarySchema = z.object({
  weekDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Controller Usage:**
```typescript
// server/src/summaries/controller.ts
async generate(req, res, next) {
  try {
    // Validate request body
    const { weekDate } = generateWeeklySummarySchema.parse(req.body);

    // Business logic
    const summary = await weeklySummariesService.generateWeeklySummary(
      new Date(weekDate)
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }
    next(error);
  }
}
```

### Validation Layers

**Layer 1: Middleware** - Checks authentication, authorization
**Layer 2: Schema Validation** - Validates request structure and types
**Layer 3: Business Logic** - Validates business rules

**Example:**
```typescript
// Layer 1: Middleware
requireAuth, requireAdmin

// Layer 2: Schema Validation
const { weekDate } = schema.parse(req.body);

// Layer 3: Business Logic
const existingSummary = await prisma.weeklySummary.findFirst({
  where: { weekStartDate }
});
if (existingSummary) {
  throw new Error('Summary already exists for this week');
}
```

## Error Handling Pipeline

### Error Flow

```
Error occurs in application
    ↓
Try-catch block in controller?
    ├─ Yes → Handle error, return appropriate response
    └─ No → Pass to global error handler (next(error))
        ↓
Global error middleware
    ├─ Log error to console
    ├─ Determine error type
    │   ├─ ZodError → 400 Bad Request
    │   ├─ Authentication error → 401 Unauthorized
    │   ├─ Authorization error → 403 Forbidden
    │   ├─ Not found error → 404 Not Found
    │   ├─ Prisma error → 500 Internal Server Error
    │   └─ Unknown error → 500 Internal Server Error
    └─ Return JSON error response
```

### Error Response Format

**Standard Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "message": "Human-readable message"
}
```

**Validation Error Response:**
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": [
    {
      "path": ["weekDate"],
      "message": "Invalid date format"
    }
  ]
}
```

### Error Types and Status Codes

| Error Type | Status Code | Response |
|------------|-------------|----------|
| Validation error | 400 | Invalid request data |
| Authentication error | 401 | Unauthorized / Invalid token |
| Authorization error | 403 | Admin access required |
| Not found | 404 | Resource not found |
| Conflict | 409 | Resource already exists |
| Internal error | 500 | Internal server error |

### Global Error Handler

**Location:** `server/src/index.ts`

```typescript
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});
```

## Response Format

### Success Response

**Standard Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**List Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

### Pagination

**Query Parameters:**
- `limit` - Number of items per page (default: 10)
- `offset` - Number of items to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "summaries": [...],
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

**Client-side pagination:**
```typescript
const { data } = useQuery({
  queryKey: ['summaries', page],
  queryFn: () => get(`/api/summaries?limit=10&offset=${page * 10}`)
});
```

## Real-time Event Pipeline

### Socket.IO Connection Flow

```
1. Client connects to Socket.IO server
    ↓
2. Server: 'connection' event
    ├─ Authenticate socket (verify JWT)
    ├─ Store socket in connectedUsers map
    └─ Emit 'user_online' event
    ↓
3. Client: Join conversation rooms
   emit('join_conversation', { conversationId })
    ↓
4. Server: 'join_conversation' event
    ├─ Validate user is conversation member
    ├─ socket.join(conversationId)
    └─ Broadcast user joined
    ↓
5. Client: Send message
   emit('send_message', { conversationId, content })
    ↓
6. Server: 'send_message' event
    ├─ Validate message content
    ├─ Save message to database
    ├─ Emit 'new_message' to conversation room
    └─ Check for mentions, send notifications
    ↓
7. All clients in room: Receive 'new_message' event
    ├─ Update React Query cache
    └─ Display message in UI
```

### Event Pipeline Diagram

```
Client A                Server                Client B
   │                      │                      │
   ├─── connect ─────────→│                      │
   │                      ├─ authenticate        │
   │                      ├─ join room           │
   │←─── connected ───────┤                      │
   │                      │                      │
   ├─ send_message ──────→│                      │
   │                      ├─ validate            │
   │                      ├─ save to DB          │
   │                      ├─────── broadcast ───→│
   │←─── new_message ─────┤                      │
   │                      │←─── new_message ─────┤
```

### Socket Authentication

**Flow:**
```typescript
io.on('connection', (socket) => {
  // Extract token from handshake
  const token = socket.handshake.auth.token;

  // Verify JWT
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Load user
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId }
  });

  // Attach to socket
  socket.user = user;

  // Store in connected users
  connectedUsers.set(user.id, socket.id);
});
```

## Weekly Summary Generation Pipeline

### Complete Pipeline Flow

```
1. Trigger (Manual or Scheduled)
   │
   ├─ Manual: POST /api/summaries/generate
   └─ Scheduled: Cron job (Monday 9 AM)
    ↓
2. Validate Request
   ├─ Check admin permissions (manual only)
   ├─ Validate week date format
   └─ Check summary doesn't already exist
    ↓
3. Gather Data
   ├─ Calculate week date range (Mon-Sun)
   ├─ Query daily updates for the week
   └─ Group updates by user
    ↓
4. Generate AI Summaries (Parallel)
   ├─ For each user with updates:
   │   ├─ Format daily updates
   │   ├─ Call OpenAI API
   │   ├─ Parse response (summary, impact, reasoning)
   │   └─ Return member summary
   └─ Wait for all to complete
    ↓
5. Save to Database
   ├─ Create WeeklySummary record
   ├─ Create MemberWeeklySummary records
   └─ Return complete summary
    ↓
6. Email Delivery (Optional)
   ├─ Check if email enabled
   ├─ Format HTML email
   ├─ Send via Nodemailer
   └─ Mark as sent in database
    ↓
7. Response
   └─ Return summary to client
```

### Detailed Service Layer Flow

```typescript
// server/src/summaries/service.ts

async generateWeeklySummary(weekDate: Date) {
  // Step 1: Calculate week boundaries
  const { startDate, endDate } = this.getWeekBoundaries(weekDate);

  // Step 2: Check for existing summary
  const existing = await prisma.weeklySummary.findFirst({
    where: { weekStartDate: startDate }
  });
  if (existing) {
    throw new Error('Summary already exists');
  }

  // Step 3: Get daily updates
  const updates = await prisma.dailyUpdate.findMany({
    where: {
      date: { gte: startDate, lte: endDate }
    },
    include: { user: true }
  });

  // Step 4: Group by user
  const grouped = this.groupUpdatesByUser(updates);

  // Step 5: Generate AI summaries in parallel
  const memberSummaries = await Promise.all(
    Object.entries(grouped).map(([userId, userUpdates]) =>
      this.generateMemberSummary(userId, userUpdates)
    )
  );

  // Step 6: Save to database
  const summary = await prisma.weeklySummary.create({
    data: {
      weekStartDate: startDate,
      weekEndDate: endDate,
      generatedAt: new Date(),
      memberSummaries: {
        create: memberSummaries.map(ms => ({
          userId: ms.userId,
          summary: ms.summary,
          impactLevel: ms.impactLevel,
          rawUpdates: {
            updates: ms.rawUpdates,
            reasoning: ms.reasoning
          }
        }))
      }
    },
    include: {
      memberSummaries: {
        include: { user: true }
      }
    }
  });

  return summary;
}
```

### OpenAI Integration Pipeline

```
Service Layer
    ↓
1. Format user updates into prompt
   ```
   User: John Doe
   Updates:
   - Monday: Completed feature X
   - Wednesday: Fixed bug Y
   - Friday: Reviewed PRs
   ```
    ↓
2. Call OpenAI API (lib/openai.ts)
   ├─ Model: gpt-3.5-turbo
   ├─ Temperature: 0.7
   ├─ Max tokens: 500
   └─ Timeout: 30s
    ↓
3. Parse structured response
   {
     summary: "John made significant progress...",
     impactLevel: "HIGH",
     reasoning: "Multiple features delivered..."
   }
    ↓
4. Error handling
   ├─ Retry on transient errors (3 attempts)
   ├─ Fallback on persistent errors
   └─ Log errors for monitoring
    ↓
5. Return to service layer
```

### Email Pipeline

```
Weekly Summary Created
    ↓
1. Check email configuration
   ├─ Email sending enabled?
   ├─ Recipient email configured?
   └─ SMTP credentials valid?
    ↓
2. Format email content
   ├─ Group summaries by impact level
   ├─ Apply HTML template
   ├─ Add styling (inline CSS)
   └─ Generate plain text fallback
    ↓
3. Send via Nodemailer
   ├─ Connect to Gmail SMTP
   ├─ Authenticate
   ├─ Send email
   └─ Handle delivery errors
    ↓
4. Update database
   ├─ Mark summary as sent
   └─ Record sent timestamp
    ↓
5. Return success/failure
```

## Examples

### Example 1: Get Grouped Weekly Summary

**Request:**
```http
GET /api/summaries/2025-01-22/grouped HTTP/1.1
Host: api.servicebay.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Pipeline:**
```
1. [0ms] Request received
2. [1ms] CORS middleware - validate origin
3. [2ms] Body parser - parse JSON (none in GET)
4. [3ms] requireAuth middleware
   ├─ Extract Bearer token
   ├─ Verify JWT signature
   ├─ Decode payload: { userId: "abc123" }
   ├─ Query database for user
   └─ Attach req.user
5. [5ms] Route handler: controller.getGrouped()
   ├─ Validate weekDate param with Zod
   ├─ Call service.getGroupedMemberSummaries()
   │   ├─ Query database for WeeklySummary
   │   ├─ Group member summaries by impact level
   │   └─ Calculate statistics
   └─ Format response
6. [50ms] Return JSON response
```

**Response:**
```json
{
  "success": true,
  "data": {
    "weekStartDate": "2025-01-22",
    "weekEndDate": "2025-01-28",
    "generatedAt": "2025-01-29T09:00:00Z",
    "grouped": {
      "high": [
        {
          "id": "summary1",
          "userId": "user1",
          "summary": "Completed major feature X...",
          "impactLevel": "HIGH",
          "user": { "name": "John Doe", ... }
        }
      ],
      "medium": [...],
      "low": [...]
    },
    "stats": {
      "total": 5,
      "high": 1,
      "medium": 2,
      "low": 2
    }
  }
}
```

### Example 2: Generate Weekly Summary (Admin)

**Request:**
```http
POST /api/summaries/generate HTTP/1.1
Host: api.servicebay.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "weekDate": "2025-01-22"
}
```

**Pipeline:**
```
1. [0ms] Request received
2. [1ms] CORS middleware
3. [2ms] Body parser - parse JSON body
4. [3ms] requireAuth middleware
5. [5ms] requireAdmin middleware
   ├─ Check req.user.role === 'ADMIN'
   └─ Continue or 403
6. [6ms] controller.generate()
   ├─ Validate request body with Zod
   ├─ Call service.generateWeeklySummary()
   │   ├─ [7ms] Calculate week boundaries
   │   ├─ [8ms] Check for existing summary
   │   ├─ [10ms] Query daily updates
   │   ├─ [15ms] Group by user
   │   ├─ [20ms-5000ms] Generate AI summaries (parallel)
   │   │   ├─ Call OpenAI API for each user
   │   │   ├─ Parse responses
   │   │   └─ Handle errors
   │   └─ [5050ms] Save to database
   └─ [5055ms] Format response
7. [5056ms] Return JSON response
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "summary123",
    "weekStartDate": "2025-01-22T00:00:00Z",
    "weekEndDate": "2025-01-28T23:59:59Z",
    "generatedAt": "2025-01-29T14:30:00Z",
    "memberSummaries": [...]
  },
  "message": "Weekly summary generated successfully"
}
```

### Example 3: Socket.IO Message Send

**Client Code:**
```typescript
socket.emit('send_message', {
  conversationId: 'conv123',
  content: 'Hello team!',
  driveFileIds: []
});
```

**Server Pipeline:**
```
1. [0ms] Socket receives 'send_message' event
2. [1ms] Validate socket is authenticated
3. [2ms] Extract data: { conversationId, content, driveFileIds }
4. [3ms] Validate user is conversation member
5. [5ms] Save message to database
   ├─ Create Message record
   ├─ Link attachments if any
   └─ Return saved message
6. [50ms] Broadcast to conversation room
   io.to(conversationId).emit('new_message', message)
7. [51ms] Check for @mentions
   ├─ Parse content for @username patterns
   ├─ Find mentioned users
   └─ Emit 'mention_notification' to each
8. [55ms] Complete
```

**All Clients in Room Receive:**
```typescript
socket.on('new_message', (message) => {
  // Update React Query cache
  queryClient.setQueryData(['messages', conversationId], (old) => [
    ...old,
    message
  ]);
});
```

## Performance Considerations

### Database Query Optimization
- Use indexes on frequently queried columns (`userId`, `conversationId`, `weekStartDate`)
- Use `select` to limit returned fields
- Batch operations with `createMany` where possible

### API Response Time Targets
- Simple queries: < 100ms
- Complex queries: < 500ms
- AI generation: < 30s (network dependent)
- Socket events: < 50ms

### Bottleneck Identification
1. **Slow database queries** - Check Prisma logs, add indexes
2. **External API delays** - OpenAI can take 5-10s per call, use parallel processing
3. **Large response payloads** - Implement pagination, compress responses
4. **Memory leaks** - Monitor Node.js heap usage, profile with Chrome DevTools

### Example 4: Admin Missing Updates Check

**Request:**
```http
GET /api/admin/updates/missing?startDate=2025-01-20&endDate=2025-01-27 HTTP/1.1
Host: api.servicebay.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Pipeline:**
```
1. [0ms] Request received
2. [1ms] CORS middleware
3. [3ms] requireAuth middleware - validate JWT
4. [5ms] requireAdmin middleware - check ADMIN role
5. [6ms] controller.getMissingUpdates()
   ├─ Validate query parameters with Zod
   ├─ Call missingUpdatesService.getMissingUpdates()
   │   ├─ [7ms] Get configuration from AdminSettings
   │   ├─ [10ms] Calculate expected dates (business days only)
   │   ├─ [15ms] Query users to check
   │   ├─ [20ms] Query daily updates in range
   │   ├─ [25ms] Compare and find missing dates
   │   └─ [30ms] Return result
   └─ [31ms] Format response
6. [32ms] Return JSON response
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "user1",
        "userName": "John Doe",
        "userEmail": "john@example.com",
        "missingDates": ["2025-01-20", "2025-01-21"]
      }
    ],
    "dateRange": {
      "startDate": "2025-01-20",
      "endDate": "2025-01-27"
    },
    "totalUsers": 1,
    "totalMissingDays": 2
  }
}
```

### Example 5: Send Update Reminder (Admin)

**Request:**
```http
POST /api/admin/updates/send-reminder HTTP/1.1
Host: api.servicebay.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "userId": "user1",
  "missingDates": ["2025-01-20", "2025-01-21"]
}
```

**Pipeline:**
```
1. [0ms] Request received
2. [1ms] CORS middleware
3. [2ms] Body parser - parse JSON
4. [3ms] requireAuth middleware
5. [5ms] requireAdmin middleware
6. [6ms] controller.sendUpdateReminder()
   ├─ Validate request body with Zod
   ├─ Check notification cooldown (admin bypasses)
   ├─ Format dates for display
   ├─ Create notification payload
   ├─ Emit WebSocket to user's room: `user:${userId}`
   ├─ Record notification in cooldown service
   └─ Return response
7. [20ms] Return JSON response
```

**WebSocket Event:**
```
Socket.IO emits to room: "user:user1"
Event: "update_reminder"
Payload:
{
  type: "update_reminder",
  title: "Daily Update Reminder",
  message: "You have missing daily updates for: Jan 20, Jan 21",
  missingDates: ["2025-01-20", "2025-01-21"],
  link: "/updates",
  timestamp: "2025-01-27T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reminder notification sent successfully",
  "data": {
    "userId": "user1",
    "missingDates": ["2025-01-20", "2025-01-21"],
    "sentAt": "2025-01-27T10:30:00Z",
    "cooldownBypassed": false,
    "timeRemainingMs": 0
  }
}
```

---

**Last Updated:** 2025-01-27
**Maintained By:** Development Team
