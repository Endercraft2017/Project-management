# ServiceBay PM - System Architecture Guide

**Last Updated:** 2025-10-23
**Version:** 2.0
**Environment:** Production

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Architecture Patterns](#architecture-patterns)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication & Authorization](#authentication--authorization)
- [Real-time Communication](#real-time-communication)
- [Background Jobs & Scheduling](#background-jobs--scheduling)
- [External Integrations](#external-integrations)
- [Deployment Architecture](#deployment-architecture)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Overview

ServiceBay PM is a comprehensive project management application designed for teams to collaborate, track tasks, manage sprints, communicate, and monitor progress. The application features AI-powered weekly summaries generated using OpenAI's GPT-3.5 Turbo.

### Key Capabilities

- **Task Management:** Hierarchical tasks with subtasks, progress tracking, and assignments
- **Sprint Management:** Agile sprint planning with Gantt chart visualization
- **Team Communication:** Real-time chat with file attachments, threads, reactions, and mentions
- **Daily Updates:** Team members submit daily progress updates
- **Weekly Summaries:** AI-powered summaries of team activity with impact assessment
- **Google Drive Integration:** Attach and preview Google Drive files in messages
- **Email Notifications:** Automated weekly summary emails to stakeholders

## Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **State Management:** React Query (TanStack Query) for server state
- **Styling:** Tailwind CSS with dark mode support
- **UI Components:** Radix UI primitives
- **Real-time:** Socket.IO client
- **Charts:** Recharts
- **Gantt Charts:** Frappe Gantt
- **Rich Text:** Markdown support with syntax highlighting
- **File Preview:** Built-in viewers for images, PDFs, CSV, markdown, and Google Docs

### Backend
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** Google OAuth 2.0 + JWT
- **Real-time:** Socket.IO
- **File Storage:** Local filesystem (future: Google Drive API)
- **Email:** Nodemailer with Gmail SMTP
- **Scheduling:** node-cron for background jobs
- **AI Integration:** OpenAI API (GPT-3.5 Turbo)
- **Validation:** Zod schemas

### Infrastructure
- **Deployment:** Railway (full-stack deployment)
- **Environment:** Node.js runtime
- **Database:** Railway PostgreSQL
- **Domain:** Custom domain with SSL

## Project Structure

```
Project-management-fresh/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── auth/      # Authentication components
│   │   │   ├── chat/      # Messaging & communication
│   │   │   ├── gantt/     # Gantt chart visualization
│   │   │   ├── summary/   # Analytics & summary views
│   │   │   ├── summaries/ # Weekly AI summaries (NEW)
│   │   │   ├── tasks/     # Task management
│   │   │   ├── updates/   # Daily updates
│   │   │   └── users/     # User management
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   ├── pages/         # Page components
│   │   ├── styles/        # Global styles
│   │   └── types/         # TypeScript type definitions
│   ├── dist/              # Built frontend assets
│   └── public/            # Static assets
│
├── server/                # Backend application
│   ├── src/
│   │   ├── admin/         # Admin settings management
│   │   ├── auth/          # Authentication logic
│   │   ├── chat/          # Chat functionality
│   │   ├── config/        # Configuration management
│   │   ├── daily-updates/ # Daily update handling
│   │   ├── drive/         # Google Drive integration
│   │   ├── gantt/         # Gantt chart data endpoints
│   │   ├── lib/           # Utility libraries
│   │   │   ├── email.ts   # Email sending (Nodemailer)
│   │   │   ├── openai.ts  # OpenAI API integration (NEW)
│   │   │   └── scheduler.ts # Cron job scheduling (NEW)
│   │   ├── middleware/    # Express middleware
│   │   ├── notes/         # Notes feature
│   │   ├── socket/        # Socket.IO handlers
│   │   ├── sprints/       # Sprint management
│   │   ├── summaries/     # Weekly summaries (NEW)
│   │   │   ├── routes.ts
│   │   │   ├── controller.ts
│   │   │   ├── service.ts
│   │   │   └── validators.ts
│   │   ├── sync/          # Google Sheets sync
│   │   ├── tasks/         # Task management
│   │   ├── users/         # User management
│   │   └── index.ts       # Main server entry
│   └── uploads/           # Uploaded file storage
│
├── prisma/                # Database schema & migrations
│   ├── schema.prisma      # Prisma schema definition
│   └── migrations/        # Migration history
│
├── docs/                  # Documentation
│   ├── error_fixes/       # Error fix documentation
│   ├── 2tasks.md          # Task tracking
│   ├── 3logs.md           # Error logs
│   └── 4doc.md            # Additional docs
│
└── .claude/               # Claude AI configuration
    ├── commands/          # Custom slash commands
    └── settings.local.json
```

## Core Features

### 1. Task Management
**Location:** `server/src/tasks/`, `client/src/components/tasks/`

- Hierarchical task structure with unlimited nesting levels
- Task properties: name, details, progress (0-100%), assigned user, dates, sprint
- Parent-child relationships for subtasks
- Progress tracking and completion status
- Task filtering by sprint, user, status
- Bulk operations (import from CSV, export to Google Sheets)

### 2. Sprint Management
**Location:** `server/src/sprints/`, `client/src/components/gantt/`

- Sprint lifecycle: PLANNED → ACTIVE → COMPLETED
- Start/end date management
- Task assignment to sprints
- Gantt chart visualization with Frappe Gantt
- Sprint statistics (task count, completion rate)

### 3. Team Chat
**Location:** `server/src/chat/`, `client/src/components/chat/`

- Real-time messaging with Socket.IO
- Conversation types: Direct Messages (DM) and Group Channels
- Message features:
  - File attachments (local upload or Google Drive)
  - Message threads (nested replies)
  - Emoji reactions
  - @mentions with notifications
  - Message editing and deletion
  - Read receipts
- Typing indicators
- Online/offline presence
- File previews (images, PDFs, CSV, markdown, Google Docs)

### 4. Daily Updates
**Location:** `server/src/daily-updates/`, `client/src/components/updates/`

- Team members submit daily progress updates
- View updates by date
- Thread-based discussions on daily updates
- Historical view of team activity
- Data source for AI weekly summaries
- **Admin Missing Updates Tracker** (NEW):
  - Detect users with missing daily updates
  - Send personalized reminder notifications
  - Configurable date ranges and user selection
  - Business days only option (Monday-Friday)
  - Real-time WebSocket notifications with deep-linking
  - Notification cooldown protection (5 hours)

### 5. Weekly AI Summaries (NEW)
**Location:** `server/src/summaries/`, `client/src/components/summaries/`

**Purpose:** Generate AI-powered weekly summaries of team activity

**Features:**
- Automatically aggregates daily updates for each team member
- Uses OpenAI GPT-3.5 Turbo to:
  - Summarize individual member contributions
  - Assess impact level (HIGH, MEDIUM, LOW)
  - Provide reasoning for impact assessment
- Displays summaries grouped by impact level
- Admin controls:
  - Manual summary generation
  - Email delivery to stakeholders
  - Configuration of email settings
- Automated weekly generation via cron job

**Architecture:**
```
Daily Updates → AI Processing → Grouped Summaries → Email Delivery
     ↓              ↓                ↓                    ↓
  Database      OpenAI API      Display UI         Nodemailer
```

### 6. Google Drive Integration
**Location:** `server/src/drive/`, `client/src/components/chat/attachments/`

- OAuth 2.0 authentication with Google
- Attach Drive files to chat messages
- File picker UI
- Preview Drive files (Docs, Sheets, Slides, Images)
- Automatic thumbnail generation
- Token refresh handling

### 7. Google Sheets Sync
**Location:** `server/src/sync/`

- Bidirectional sync between database and Google Sheets
- Export tasks to Sheets
- Import tasks from Sheets
- Conflict resolution UI
- Sync logs and audit trail

## Architecture Patterns

### Backend Architecture

#### RESTful API Structure
```
Route → Controller → Service → Database
  ↓         ↓          ↓           ↓
Validation  Logic   Business   Prisma ORM
(Zod)              Logic
```

**Example:** Weekly Summaries
```typescript
// Route definition (routes.ts)
router.post('/api/summaries/generate',
  requireAdmin,
  weeklySummariesController.generate
);

// Controller (controller.ts)
async generate(req, res, next) {
  const { weekDate } = generateWeeklySummarySchema.parse(req.body);
  const summary = await weeklySummariesService.generateWeeklySummary(
    new Date(weekDate)
  );
  res.json({ success: true, data: summary });
}

// Service (service.ts)
async generateWeeklySummary(weekDate: Date) {
  // 1. Get daily updates for the week
  const updates = await this.getDailyUpdatesForWeek(weekDate);

  // 2. Group by user
  const groupedUpdates = this.groupUpdatesByUser(updates);

  // 3. Generate AI summaries in parallel
  const summaries = await Promise.all(
    Object.entries(groupedUpdates).map(([userId, updates]) =>
      this.generateMemberSummary(userId, updates)
    )
  );

  // 4. Save to database
  return await prisma.weeklySummary.create({ ... });
}
```

#### Middleware Stack
1. **Authentication:** `requireAuth` - Validates JWT token
2. **Authorization:** `requireAdmin` - Checks user role
3. **Validation:** Zod schema validation in controllers
4. **Error Handling:** Global error middleware
5. **Logging:** Request/response logging

#### Error Handling Pattern
```typescript
try {
  // Business logic
} catch (error) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed' });
  }
  next(error); // Pass to global error handler
}
```

### Frontend Architecture

#### Component Structure
```
Page Component
  ↓
Feature Container (data fetching)
  ↓
Presentational Components (UI only)
  ↓
Reusable UI Components (buttons, cards, etc.)
```

#### Data Fetching Pattern (React Query)
```typescript
// Custom hook (hooks/useSummaries.ts)
export function useGroupedWeeklySummary(weekDate: string) {
  return useQuery({
    queryKey: ['summaries', 'grouped', weekDate],
    queryFn: () => get<GroupedWeeklySummary>(`/api/summaries/${weekDate}/grouped`),
    enabled: !!weekDate,
  });
}

// Component usage
function WeeklySummariesView() {
  const { data, isLoading, error } = useGroupedWeeklySummary(selectedWeek);

  if (isLoading) return <Loading />;
  if (error) return <Error />;

  return <SummaryContent summary={data} />;
}
```

#### Validation Pattern
**Always validate external data before rendering:**

```typescript
export default function SummaryContent({ summary }: Props) {
  // Layer 1: Null check
  if (!summary) return <ErrorMessage />;

  // Layer 2: Structure validation
  const { grouped, stats } = summary;
  if (
    !grouped || !stats ||
    typeof grouped !== 'object' ||
    !Array.isArray(grouped.high) ||
    typeof stats.total !== 'number'
  ) {
    return <ErrorMessage message="Invalid data structure" />;
  }

  // Safe to render
  return <Content />;
}
```

**Rationale:** TypeScript types are erased at runtime. API responses may not match TypeScript interfaces due to:
- Backend errors
- Network corruption
- Caching issues
- Serialization problems

### Real-time Architecture (Socket.IO)

#### Connection Flow
```
Client connects → Authenticate → Join rooms → Receive events
```

#### Event Pattern
```typescript
// Server emits event
io.to(conversationId).emit('new_message', message);

// Client receives event
socket.on('new_message', (message) => {
  queryClient.setQueryData(['messages', conversationId], (old) => [
    ...old,
    message
  ]);
});
```

#### Room Management
- Users join conversation-specific rooms
- Events broadcast only to room members
- Automatic cleanup on disconnect

## Database Schema

### Core Tables

**Users**
- `id` (UUID, PK)
- `email` (unique)
- `name`
- `googleId` (for OAuth)
- `picture` (profile image URL)
- `role` (ADMIN | MEMBER)
- `isActive`
- `refreshToken` (encrypted)

**Sprints**
- `id` (UUID, PK)
- `name`
- `startDate`, `endDate`
- `status` (PLANNED | ACTIVE | COMPLETED)
- `createdById` (FK → Users)

**Tasks**
- `id` (UUID, PK)
- `taskName`
- `details`
- `progress` (0-100)
- `sprintId` (FK → Sprints)
- `assignedToId` (FK → Users)
- `parentTaskId` (FK → Tasks, self-reference)
- `nestingLevel` (calculated depth)
- `startDate`, `deadline`

**Conversations**
- `id` (UUID, PK)
- `type` (DM | GROUP)
- `name` (for groups)
- `createdById` (FK → Users)

**Messages**
- `id` (UUID, PK)
- `conversationId` (FK → Conversations)
- `senderId` (FK → Users)
- `content` (text)
- `parentMessageId` (FK → Messages, for threads)
- `reactions` (JSONB: { emoji: [userIds] })
- `isEdited`, `isDeleted`

**DailyUpdates**
- `id` (UUID, PK)
- `date`
- `userId` (FK → Users)
- `content`

**WeeklySummaries** (NEW)
- `id` (UUID, PK)
- `weekStartDate`, `weekEndDate`
- `generatedAt`
- `emailSentAt` (nullable)

**MemberWeeklySummaries** (NEW)
- `id` (UUID, PK)
- `weeklySummaryId` (FK → WeeklySummaries)
- `userId` (FK → Users)
- `summary` (AI-generated text)
- `impactLevel` (HIGH | MEDIUM | LOW)
- `rawUpdates` (JSONB: original daily updates + reasoning)

**AdminSettings** (NEW)
- `key` (PK, e.g., "weekly-summary-email-config")
- `value` (JSONB)
- `updatedBy` (FK → Users)
- `updatedAt`

### Relationships
- User 1:N Tasks (assigned)
- User 1:N Tasks (created)
- Sprint 1:N Tasks
- Task 1:N Tasks (parent-child)
- Conversation N:M Users (through ConversationMembers)
- Message 1:N Messages (threads)
- User 1:N DailyUpdates
- WeeklySummary 1:N MemberWeeklySummaries

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth callback
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Tasks
- `GET /api/tasks` - List tasks (with filters)
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/import` - Import tasks from CSV

### Sprints
- `GET /api/sprints` - List sprints
- `GET /api/sprints/:id` - Get sprint details
- `POST /api/sprints` - Create sprint (admin only)
- `PUT /api/sprints/:id` - Update sprint (admin only)
- `DELETE /api/sprints/:id` - Delete sprint (admin only)

### Chat
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id/messages` - Get messages (paginated)
- `POST /api/messages` - Send message (deprecated, use Socket.IO)
- `GET /api/messages/:id/thread` - Get thread replies

### Daily Updates
- `GET /api/daily-updates` - Get updates for date
- `POST /api/daily-updates` - Submit daily update
- `PUT /api/daily-updates/:id` - Edit update
- `DELETE /api/daily-updates/:id` - Delete update

### Weekly Summaries (NEW)
- `GET /api/summaries` - List all summaries (paginated)
- `GET /api/summaries/:weekDate` - Get summary for week
- `GET /api/summaries/:weekDate/grouped` - Get grouped summary (by impact)
- `POST /api/summaries/generate` - Generate summary (admin only)
- `POST /api/summaries/:weekDate/send-email` - Send summary email (admin only)
- `DELETE /api/summaries/:id` - Delete summary (admin only)

### Admin Settings (NEW)
- `GET /api/admin/settings/weekly-summary-email/config` - Get email config
- `PUT /api/admin/settings/weekly-summary-email/config` - Update email config
- `GET /api/admin/settings/missing-updates/config` - Get missing updates config
- `PUT /api/admin/settings/missing-updates/config` - Update missing updates config
- `GET /api/admin/updates/missing` - Get users with missing updates
- `POST /api/admin/updates/send-reminder` - Send update reminder notification

### Google Drive
- `GET /api/drive/auth-url` - Get OAuth URL
- `GET /api/drive/oauth-callback` - OAuth callback
- `GET /api/drive/files` - List Drive files
- `POST /api/drive/picker` - File picker data

## Authentication & Authorization

### Authentication Flow
1. User clicks "Sign in with Google"
2. Frontend redirects to `/api/auth/google`
3. Backend redirects to Google OAuth consent screen
4. User approves permissions
5. Google redirects to backend callback
6. Backend:
   - Validates authorization code
   - Retrieves user profile
   - Creates or updates user in database
   - Generates JWT access token (15min) and refresh token (7 days)
   - Stores refresh token in database (encrypted)
7. Backend redirects to frontend with tokens
8. Frontend stores tokens in localStorage
9. Frontend makes authenticated requests with JWT

### Authorization Levels
- **Public:** No authentication required
- **Authenticated:** Valid JWT required (all endpoints except auth)
- **Admin:** User role must be 'ADMIN' (sprint management, invites, summaries)

### Token Refresh
- Access tokens expire after 15 minutes
- Frontend automatically refreshes using refresh token
- Refresh tokens valid for 7 days
- After 7 days, user must re-authenticate

## Real-time Communication

### Socket.IO Events

#### Connection Events
- `connect` - Client connected
- `disconnect` - Client disconnected

#### Chat Events (Client → Server)
- `join_conversation` - Join conversation room
- `leave_conversation` - Leave conversation room
- `send_message` - Send new message
- `edit_message` - Edit message
- `delete_message` - Delete message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `add_reaction` - Add emoji reaction
- `remove_reaction` - Remove emoji reaction
- `send_thread_reply` - Send reply in thread
- `get_thread_replies` - Fetch thread replies

#### Chat Events (Server → Client)
- `new_message` - New message received
- `message_edited` - Message was edited
- `message_deleted` - Message was deleted
- `user_typing` - User is typing
- `user_stopped_typing` - User stopped typing
- `reaction_added` - Reaction added
- `reaction_removed` - Reaction removed
- `thread_reply_added` - Reply added to thread
- `mention_notification` - User was mentioned

#### Task Events (Server → Client)
- `task_created` - New task created
- `task_updated` - Task updated
- `task_deleted` - Task deleted
- `task_assigned` - Task assigned to user

#### Update Events (Server → Client)
- `daily_update_changed` - Daily update modified
- `member_daily_update` - Team member submitted update

## Background Jobs & Scheduling

### Cron Jobs (server/src/lib/scheduler.ts)

**Weekly Summary Generation**
- **Schedule:** Every Monday at 9:00 AM
- **Cron:** `0 9 * * 1`
- **Function:** `generateWeeklySummaryJob()`
- **Actions:**
  1. Calculate previous week date range (Mon-Sun)
  2. Check if summary already exists (skip if yes)
  3. Call `weeklySummariesService.generateWeeklySummary()`
  4. Log success/failure

**Weekly Summary Email**
- **Schedule:** Configurable via Admin Settings (default: Monday 10:00 AM)
- **Cron:** Dynamic based on `sendDay` and `sendTime` settings
- **Function:** `sendWeeklySummaryEmailJob()`
- **Actions:**
  1. Check if email sending is enabled
  2. Get latest summary for previous week
  3. Format summary data for email template
  4. Send email via Nodemailer
  5. Mark summary as emailed in database
  6. Log success/failure

### Job Initialization
Jobs are initialized in `server/src/index.ts` after server starts:
```typescript
initializeScheduledJobs();
console.log('✓ Scheduled jobs initialized');
```

## External Integrations

### OpenAI API (NEW)
**Purpose:** Generate AI-powered summaries of team activity

**Configuration:**
- API Key: Environment variable `OPENAI_API_KEY`
- Model: `gpt-3.5-turbo`
- Temperature: 0.7 (balanced creativity/consistency)
- Max tokens: 500 per summary

**Usage:**
```typescript
import { generateMemberSummary } from '@/lib/openai';

const summary = await generateMemberSummary(
  memberName,
  dailyUpdates // [{ date, content }]
);
// Returns: { summary, impactLevel, reasoning }
```

**Prompt Engineering:**
- Summarizes user's weekly contributions in 2-3 sentences
- Assesses impact level based on:
  - Deliverables completed
  - Problems solved
  - Team contributions
  - Learning and growth
- Provides reasoning for impact assessment

**Error Handling:**
- Retry logic for transient failures
- Fallback to "Unable to generate summary" on persistent errors
- Logging of API errors

**Rate Limits:**
- OpenAI API: 3,500 requests/minute, 90,000 tokens/minute (tier 1)
- Application: Parallel processing with `Promise.all()`
- Optimization: Single request per team member

### Google OAuth 2.0
**Purpose:** User authentication and Google Drive access

**Scopes:**
- `openid` - Basic authentication
- `profile` - User profile info
- `email` - User email address
- `https://www.googleapis.com/auth/drive.readonly` - Read Drive files
- `https://www.googleapis.com/auth/drive.file` - Access specific files

**Token Management:**
- Access tokens cached in memory
- Refresh tokens stored encrypted in database
- Automatic refresh when expired
- Revocation on logout

### Gmail SMTP (Nodemailer)
**Purpose:** Send weekly summary emails

**Configuration:**
- Host: `smtp.gmail.com`
- Port: 587 (TLS)
- Auth: Environment variables `EMAIL_USER`, `EMAIL_PASSWORD`
- From: `EMAIL_FROM_NAME` <`EMAIL_USER`>

**Email Template:**
- HTML formatted with inline CSS
- Summary grouped by impact level (color-coded)
- Responsive design
- Plain text fallback

**Error Handling:**
- Retry logic for SMTP errors
- Error logging
- Fallback to marking as "failed to send"

### Google Sheets API
**Purpose:** Bidirectional task sync

**Features:**
- Export tasks to Sheets
- Import tasks from Sheets
- Conflict detection and resolution
- Audit trail with sync logs

## Deployment Architecture

### Railway Deployment

**Build Process:**
1. Install dependencies (`npm install` in root)
2. Build client (`cd client && npm run build`)
3. Build server (`cd server && npm run build`)
4. Start production server (`npm run start` in root)

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

# Frontend
CLIENT_URL=https://your-domain.com

# OpenAI (NEW)
OPENAI_API_KEY=sk-...

# Email (NEW)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_NAME=ServiceBay PM

# Server
PORT=3000
NODE_ENV=production
```

**Health Check:**
- Endpoint: `GET /health`
- Response: `{ status: 'ok', timestamp: ISO_DATE }`

**Static File Serving:**
- Client build served from `server/dist/public/`
- API routes prioritized over static files
- Fallback to `index.html` for SPA routing

## Development Workflow

### Local Development Setup

1. **Clone repository:**
   ```bash
   git clone <repo-url>
   cd Project-management-fresh
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

3. **Configure environment:**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your credentials
   ```

4. **Setup database:**
   ```bash
   cd server
   npx prisma migrate dev
   npx prisma db seed  # Optional: seed with test data
   ```

5. **Run development servers:**
   ```bash
   # Terminal 1: Backend
   cd server
   npm run dev

   # Terminal 2: Frontend
   cd client
   npm run dev
   ```

6. **Access application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Docs: http://localhost:3000/api-docs (if configured)

### Branch Strategy

- `main` - Production branch (auto-deploy to Railway)
- `feature/*` - Feature branches (e.g., `feature/openAI`)
- `hotfix/*` - Urgent production fixes

### Commit Conventions

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build process or dependency updates

## Troubleshooting

### Common Issues

**1. Infinite Loop in Weekly Summaries**
- **Symptom:** Browser console shows repeated "Cannot read properties of undefined (reading 'length')" errors
- **Cause:** Frontend component rendering with invalid data structure
- **Solution:** Ensure client is rebuilt and deployed with validation fixes
- **Documentation:** [docs/error_fixes/2025-10-23-infinite-loop-deployment-issue.md](../docs/error_fixes/2025-10-23-infinite-loop-deployment-issue.md)

**2. OpenAI API Errors**
- **Symptom:** Weekly summary generation fails with OpenAI errors
- **Common Causes:**
  - Invalid API key
  - Rate limit exceeded
  - Network timeout
- **Solutions:**
  - Verify `OPENAI_API_KEY` in environment
  - Check OpenAI dashboard for rate limits
  - Review error logs for specific error messages

**3. Email Sending Failures**
- **Symptom:** Weekly summaries not sent via email
- **Common Causes:**
  - Invalid Gmail credentials
  - 2FA not configured with App Password
  - SMTP connection blocked
- **Solutions:**
  - Use App Password instead of regular password
  - Verify `EMAIL_USER` and `EMAIL_PASSWORD` in environment
  - Check Gmail "Less secure apps" settings
  - Review server logs for SMTP errors

**4. Database Connection Errors**
- **Symptom:** "Can't reach database server" errors
- **Solutions:**
  - Verify `DATABASE_URL` in environment
  - Check PostgreSQL service is running
  - Ensure network allows database connections
  - Verify database credentials

**5. Socket.IO Connection Issues**
- **Symptom:** Real-time features not working
- **Solutions:**
  - Check CORS configuration in `server/src/socket/`
  - Verify client is using correct Socket.IO server URL
  - Check firewall allows WebSocket connections
  - Review browser console for connection errors

### Debugging Tips

**Enable Debug Logging:**
```typescript
// server/src/index.ts
const DEBUG = true;
if (DEBUG) {
  console.log('[DEBUG]', ...);
}
```

**Check React Query DevTools:**
- Automatically enabled in development
- View cached data, query states, mutations
- Inspect failed requests

**Monitor Railway Logs:**
```bash
# View live logs
railway logs --follow

# View recent logs
railway logs
```

**Database Inspection:**
```bash
cd server
npx prisma studio
# Opens GUI at http://localhost:5555
```

### Performance Optimization

**Backend:**
- Use database indexes on frequently queried columns
- Implement pagination for large datasets
- Cache expensive computations (Redis in future)
- Use connection pooling for database

**Frontend:**
- Code splitting with dynamic imports
- Lazy load heavy components
- Optimize images (use WebP format)
- Minimize bundle size (tree shaking, analyze with `vite-bundle-visualizer`)

**Database:**
- Add indexes: `userId`, `conversationId`, `weekStartDate`
- Use `select` to limit returned fields
- Batch database operations where possible

## Additional Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **React Query Docs:** https://tanstack.com/query/latest/docs/react
- **Socket.IO Docs:** https://socket.io/docs/v4
- **OpenAI API Docs:** https://platform.openai.com/docs/api-reference
- **Tailwind CSS Docs:** https://tailwindcss.com/docs

## Support & Contact

For questions or issues:
1. Check existing documentation in `docs/`
2. Review error fix documentation in `docs/error_fixes/`
3. Search GitHub issues (if applicable)
4. Contact development team

---

**Document Status:** Active
**Last Review:** 2025-10-23
**Next Review:** 2025-11-23
