# Project Management Webapp - Technical Plan

## Overview
A simple, secure, and modern project management web application for ServiceBay.ai team (~15 developers). Monolithic architecture deployed on Railway with Google Sheets as the data source. Features light/dark theme, Google OAuth authentication restricted to @servicebay.ai domain, and real-time task tracking with Gantt charts.

**Key Requirements:**
- Small team usage (up to 15 developers)
- Simple but secure implementation
- Modern UI with light/dark theme
- Google Sheets sync for data storage
- Easy deployment on Railway

## Technology Stack

### Language
- **TypeScript** for both frontend and backend (full-stack type safety)

### Backend
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js (minimal, fast web framework)
- **Language**: TypeScript (strict mode enabled)
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Google Sheets Integration**: Google Sheets API v4 with googleapis npm package
- **Session Management**: express-session with PostgreSQL session store
- **Real-time Communication**: Socket.io for WebSocket connections (chat, live updates)
- **File Upload**: multer (for CSV/Excel uploads and chat attachments)
- **CSV/Excel Parsing**: papaparse (CSV), xlsx (Excel)
- **Validation**: Zod for runtime type validation

### Frontend
- **Framework**: React 18+ (TypeScript)
- **Build Tool**: Vite (fast, modern bundler)
- **Language**: TypeScript (strict mode)
- **UI Library**: Tailwind CSS + shadcn/ui components (built-in dark mode support)
- **State Management**: React Context API + TanStack Query (React Query) for data fetching
- **Theme**: next-themes for light/dark mode toggle
- **Charts**:
  - Recharts for bar charts (progress visualization)
  - Frappe Gantt (open-source, zero dependencies) for Gantt chart
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios or Fetch API
- **WebSocket Client**: Socket.io client

### Database
- **PostgreSQL** - Primary database hosted on Railway (free tier)
- **ORM**: Prisma for type-safe database access
- **Google Sheets Integration** - Bi-directional sync for task data only
- Session storage: PostgreSQL session store (persistent sessions)

### Deployment
- **Platform**: Railway
- **Build**: Single Docker container with Node.js
- **Environment Variables**: Google OAuth credentials, Sheet ID, Admin emails

### Why TypeScript for Full Stack?

**End-to-End Type Safety:**
```typescript
// Database (Prisma schema generates TypeScript types)
// prisma/schema.prisma
model Task {
  id          String   @id @default(uuid())
  taskName    String
  progress    Int
  assignedTo  User     @relation(fields: [assignedToId], references: [id])
}

// Backend API (Express + TypeScript)
import { Task } from '@prisma/client';

app.get('/api/tasks/:id', async (req, res) => {
  const task: Task = await prisma.task.findUnique({
    where: { id: req.params.id }
  });
  res.json(task); // TypeScript validates response
});

// Frontend (React + TypeScript)
import { Task } from '@/types/models'; // Shared types

const TaskComponent = () => {
  const { data: task } = useQuery<Task>('/api/tasks/123');
  return <div>{task?.taskName}</div>; // Autocomplete works!
};
```

**Benefits:**
- ✅ **No type mismatches** between frontend and backend
- ✅ **Autocomplete everywhere** (IDE knows exact data shapes)
- ✅ **Catch errors at compile time** (not runtime)
- ✅ **Refactoring is safe** (rename a field, all uses update)
- ✅ **Self-documenting code** (types serve as documentation)
- ✅ **Shared validation** (Zod schemas work on both sides)

## Data Architecture

### PostgreSQL Database Schema

The app uses PostgreSQL as the primary database with the following tables:

#### Users Table
```sql
id: UUID (primary key)
email: VARCHAR (unique)
name: VARCHAR
picture: VARCHAR (Google profile pic)
role: ENUM ('admin', 'member')
is_active: BOOLEAN
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### Sprints Table
```sql
id: UUID (primary key)
name: VARCHAR
start_date: DATE
end_date: DATE
status: ENUM ('active', 'completed', 'planned')
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### Tasks Table
```sql
id: UUID (primary key)
task_name: VARCHAR
sprint_id: UUID (foreign key)
parent_task_id: UUID (nullable, self-reference)
details: TEXT
progress: INTEGER (0-100)
assigned_to: UUID (foreign key to users)
start_date: DATE
deadline: DATE
nesting_level: INTEGER (0-3)
created_by: UUID (foreign key to users)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### Conversations Table
```sql
id: UUID (primary key)
type: ENUM ('dm', 'group')
name: VARCHAR (nullable for DMs)
description: TEXT (nullable)
created_by: UUID (foreign key to users)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### ConversationMembers Table (junction table)
```sql
id: UUID (primary key)
conversation_id: UUID (foreign key)
user_id: UUID (foreign key)
is_admin: BOOLEAN
joined_at: TIMESTAMP
```

#### Messages Table
```sql
id: UUID (primary key)
conversation_id: UUID (foreign key)
sender_id: UUID (foreign key to users)
content: TEXT
attachments: JSON (array of file URLs)
reactions: JSON (emoji → user_id array)
is_edited: BOOLEAN
is_deleted: BOOLEAN
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### Google Sheets Integration (Tasks Only)

**Your Google Sheets Structure (Synced):**
`Tasks | Subtasks | Sprint | Details | Progress % | Assigned to | Deadline`

**Sync Strategy:**
- **PostgreSQL = Source of Truth** for the app
- **Google Sheets = View/Edit Interface** for external access
- **Bi-directional sync** every 2 minutes:
  - App writes to PostgreSQL → Syncs to Sheets
  - Sheets edited → Syncs to PostgreSQL
- **Conflict resolution**: Last-write-wins with timestamp

**What's Synced:**
- ✅ Tasks (with hierarchy flattened in Sheets)
- ✅ Sprints
- ✅ Progress updates
- ✅ Assignments
- ✅ Deadlines

**What's NOT Synced (PostgreSQL only):**
- ❌ Chat messages and conversations
- ❌ User authentication data
- ❌ File attachments
- ❌ Message reactions

**Google Sheets Mapping:**
| Sheet Column | PostgreSQL Field | Notes |
|--------------|------------------|-------|
| Tasks | task_name | Main task name |
| Subtasks | parent_task.task_name | Parent task name (for reference) |
| Sprint | sprint.name | Sprint name |
| Details | details | Task details |
| Progress % | progress | 0-100 |
| Assigned to | user.email | Email address |
| Deadline | deadline | End date |

**Additional Columns in Sheets (auto-managed):**
- `TaskID`: Auto-generated ID for reference
- `StartDate`: For Gantt chart (synced from PostgreSQL)
- `ParentTaskID`: For hierarchy tracking

## Core Features & Implementation

### 1. Authentication & Authorization

**Implementation:**
- Google OAuth 2.0 with `hd` parameter restriction to `servicebay.ai`
- Additional server-side validation to ensure email domain
- Role-based access control (RBAC): `admin`, `member`
- Admin designation via environment variable (comma-separated emails)

**Security Best Practices:**
- Store OAuth tokens securely in session with httpOnly cookies
- Implement CSRF protection
- Use Helmet.js for security headers
- Rate limiting with express-rate-limit

**Code Structure:**
```
src/
  auth/
    passport-config.ts      # Passport Google strategy
    middleware.ts           # Auth middleware
    rbac.ts                 # Role-based access control
```

### 2. Database & Google Sheets Integration

**PostgreSQL Setup (Railway):**
- Provision PostgreSQL database on Railway (free tier)
- Use Prisma ORM for type-safe database access
- Automatic migrations with Prisma Migrate
- Connection pooling for performance

**Google Sheets Sync Implementation:**
- **PostgreSQL is the source of truth** - All app operations write to PostgreSQL first
- **Manual sync via button** - User clicks "Sync with Google Sheets" button
- **Bi-directional sync** when triggered:
  - **Direction 1: PostgreSQL → Sheets** (Export: Push tasks to Sheets)
  - **Direction 2: Sheets → PostgreSQL** (Import: Pull tasks from Sheets)
- **Conflict Resolution**: Last-write-wins based on `updated_at` timestamp
- **Sync Status Indicator**: Shows last sync time and sync status (syncing/success/error)

**Sync Process:**
```
User clicks "Export to Sheets" → PostgreSQL → Google Sheets
User clicks "Import from Sheets" → Google Sheets → PostgreSQL
User clicks "Sync Both Ways" → Compare timestamps → Merge changes
```

**Why Manual Sync:**
- User has full control over when data syncs
- No background polling overhead
- Clear visibility of sync status
- Prevents accidental overwrites
- Better for occasional external updates

**Setup Process:**
1. Create Google Cloud project (free tier)
2. Enable Google Sheets API
3. Create OAuth 2.0 credentials for login
4. Create Service Account for backend API access
5. Share your Google Sheet with service account email

**Why PostgreSQL + Sheets Sync:**
- PostgreSQL: Fast queries, complex relationships, chat storage
- Sheets: External viewing, reporting, familiar spreadsheet interface
- Best of both worlds: Database performance + Spreadsheet accessibility

**Code Structure:**
```
src/
  database/
    prisma/
      schema.prisma        # Database schema
      migrations/          # Database migrations
    client.ts              # Prisma client singleton
  sheets/
    client.ts              # Google Sheets API client
    sync-service.ts        # Bi-directional sync logic
    task-mapper.ts         # Map between DB and Sheets format
```

### 3. CSV/Excel Upload Feature

**Implementation:**
- Upload endpoint with file validation (max 5MB - small team)
- Parse CSV/Excel and map columns to database structure
- Validation: Check required columns (Tasks, Sprint, Details, Progress %, Assigned to, Deadline)
- Auto-generate missing fields (UUIDs, StartDate, ParentTaskID, etc.)
- Append or replace options
- Write to PostgreSQL → Auto-syncs to Sheets

**Workflow:**
```
Upload File → Parse → Validate → Show Preview → Confirm → PostgreSQL → Sheets Sync
```

### 4. Task Management System

#### Hierarchical Task Structure
- Tasks belong to Sprints
- **Maximum 4 nesting levels** (as requested):
  - Level 0: Task
  - Level 1: Subtask
  - Level 2: Sub-subtask
  - Level 3: Sub-sub-subtask
- Each level can have assigned users and progress tracking
- Start date + Deadline for Gantt chart visualization

#### Permission Model
- **Admin**: Full CRUD access to all tasks
- **Member**:
  - View tasks assigned to them
  - View parent tasks if assigned to any child
  - View child tasks if assigned to parent
  - Create subtasks under their assigned tasks
  - Update progress on their assigned tasks

#### API Endpoints

**Task Management:**
```
GET    /api/sprints                    # List all sprints
GET    /api/sprints/:id/tasks          # Tasks in sprint (filtered by user)
GET    /api/tasks/:id                  # Task details with hierarchy
POST   /api/tasks                      # Create task (admin only)
POST   /api/tasks/:id/subtasks         # Create subtask (assigned user or admin)
PUT    /api/tasks/:id                  # Update task
PUT    /api/tasks/:id/progress         # Update progress only
DELETE /api/tasks/:id                  # Delete task (admin only)
```

**Google Sheets Sync (Admin only):**
```
POST   /api/sync/export-to-sheets      # Export PostgreSQL tasks to Google Sheets
POST   /api/sync/import-from-sheets    # Import Google Sheets tasks to PostgreSQL
POST   /api/sync/bidirectional         # Sync both ways (merge changes)
GET    /api/sync/status                # Get last sync status and timestamp
```

**Chat Endpoints:**
```
GET    /api/conversations              # List user's conversations (DM + groups)
GET    /api/conversations/:id          # Get conversation details
POST   /api/conversations/dm           # Create/get DM conversation
POST   /api/conversations/group        # Create group chat (name, description, members)
PUT    /api/conversations/:id          # Update group (name, description)
DELETE /api/conversations/:id          # Delete group (admin only) or leave group

GET    /api/conversations/:id/messages # Get messages in conversation (paginated)
POST   /api/conversations/:id/messages # Send message
PUT    /api/messages/:id               # Edit message (own messages only)
DELETE /api/messages/:id               # Delete message (own messages only)

POST   /api/conversations/:id/members  # Add members to group (admin only)
DELETE /api/conversations/:id/members/:userId # Remove member (admin only)

POST   /api/messages/:id/reactions     # Add reaction to message
DELETE /api/messages/:id/reactions/:emoji # Remove reaction
```

**WebSocket Events:**
```
// Client → Server
'join_conversation'    # Join conversation room
'leave_conversation'   # Leave conversation room
'send_message'         # Send message
'typing_start'         # User started typing
'typing_stop'          # User stopped typing
'mark_read'            # Mark messages as read

// Server → Client
'new_message'          # New message received
'message_deleted'      # Message was deleted
'message_edited'       # Message was edited
'user_typing'          # Someone is typing
'user_online'          # User came online
'user_offline'         # User went offline
'conversation_updated' # Group info changed
```

**Code Structure:**
```
src/
  tasks/
    controller.ts          # Route handlers
    service.ts             # Business logic
    permissions.ts         # Access control logic
    validators.ts          # Input validation
```

### 5. UI Design & Theme

**Modern Design Principles:**
- Clean, minimal interface inspired by Linear, Notion
- Consistent spacing and typography
- Smooth transitions and animations
- Responsive design (desktop-first, mobile-compatible)

**Light/Dark Theme Implementation:**
- Using `next-themes` + Tailwind CSS dark mode
- Theme toggle button in header
- Persisted preference in localStorage
- All components styled with Tailwind dark: variants
- Color palette:
  - Light: Clean whites, soft grays
  - Dark: Deep grays, subtle accent colors

**Component Library:**
- shadcn/ui components (pre-built, customizable)
- Includes: Button, Input, Select, Dialog, Tabs, Card, etc.
- Already supports dark mode out of the box

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Header: Logo | Tasks | Summary | Gantt | Chat  │  ← Theme toggle, User menu, Notifications
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Main Content Area (Tab-based)                          │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Chat Tab Layout:**
```
┌─────────────┬──────────────────────────────┬─────────────┐
│ Conversations│     Chat Messages            │ Group Info  │
│ List         │                              │ (optional)  │
│              │                              │             │
│ 🔍 Search    │  👤 User Name                │ 👥 Members  │
│              │  ─────────────────────       │             │
│ Direct Msgs  │  Message 1                   │ John Doe    │
│ • John Doe   │  Message 2                   │ Jane Smith  │
│ • Jane Smith │  Message 3                   │             │
│              │                              │ + Add       │
│ Group Chats  │  ─────────────────────       │             │
│ • Sprint 1   │  [Type message...]  📎 😊    │             │
│ • Developers │                              │             │
│              │                              │             │
└─────────────┴──────────────────────────────┴─────────────┘
```

### 6. Dashboard Views

#### Tab 1: Tasks View
- **Header Actions**:
  - Sprint Filter dropdown
  - **Sync with Google Sheets** button (dropdown menu):
    - Export to Sheets (PostgreSQL → Sheets)
    - Import from Sheets (Sheets → PostgreSQL)
    - Sync Both Ways (bi-directional)
  - Last sync status: "Last synced: 2 minutes ago ✓"
- **Task Tree**: Hierarchical display with expand/collapse
- **Columns**: Task Name, Assigned To, Progress Bar, Deadline, Actions
- **Features**:
  - Inline progress editing
  - Add subtask button (if user has permission)
  - Color coding by deadline (red=overdue, yellow=due soon, green=on track)

#### Tab 2: Summary View
- **Overall MVP Progress**: Single horizontal bar chart showing total completion
- **Sprint Progress**: Multiple bar charts, one per sprint
- **Calculation**: Weighted average based on task complexity or simple percentage
- **Filters**: Date range, sprint selection

**Chart Implementation:**
```typescript
// Using Recharts
<BarChart data={sprintData}>
  <XAxis dataKey="sprintName" />
  <YAxis domain={[0, 100]} />
  <Bar dataKey="progress" fill="#8884d8" />
  <Tooltip />
</BarChart>
```

#### Tab 3: Gantt Chart View
- **Timeline**: All tasks with deadlines visualized
- **Dependencies**: Can be added as optional feature
- **Zoom**: Day/Week/Month views
- **Interactive**: Click to view task details

**Implementation with Frappe Gantt:**
```typescript
import Gantt from 'frappe-gantt';

const tasks = [
  {
    id: 'TSK-001',
    name: 'Task Name',
    start: '2025-01-01',
    end: '2025-01-10',
    progress: 50,
  }
];

const gantt = new Gantt("#gantt", tasks);
```

#### Tab 4: Chat View
Real-time messaging for team collaboration with direct messages and group chats.

**Features:**
- **Left Sidebar**: List of conversations
  - Direct Messages section (1-on-1 chats)
  - Group Chats section
  - Search conversations
  - Unread message indicators
  - Online status indicators

- **Main Chat Area**:
  - Message thread with timestamps
  - User avatars and names
  - Message input with file attachment support
  - Emoji picker
  - Typing indicators
  - Message reactions
  - Real-time updates

- **Right Panel** (Group Chats):
  - Group info (name, description, members)
  - Add/remove members (creator/admin only)
  - Leave group option

**Group Chat Functionality:**
- Create new group chat
- Set group name and description
- Invite members (select from team list)
- Group creator becomes group admin
- Admin can add/remove members
- Members can leave group
- Delete group (admin only)

**Direct Message Functionality:**
- Start DM with any team member
- Search for user by name/email
- Auto-create conversation on first message
- Delete conversation (only removes for you)

**Data Storage (PostgreSQL):**

Chat data is stored exclusively in PostgreSQL (not synced to Sheets):
- Conversations table: Stores chat metadata
- ConversationMembers table: Tracks group membership
- Messages table: All chat messages with attachments and reactions

**Real-time Implementation:**
- **Option 1 (Simple)**: Polling every 5 seconds for new messages
- **Option 2 (Better)**: WebSocket connection (Socket.io)
  - Instant message delivery
  - Typing indicators
  - Online/offline status
  - Read receipts

**For 15 users, WebSocket is recommended** for better chat experience.

**Chat Storage Considerations:**
- PostgreSQL stores all chat data (conversations, messages, reactions)
- Fast queries with proper indexing for message history
- Message pagination (50 messages at a time) for performance
- Real-time delivery via WebSocket, PostgreSQL as persistent storage
- File attachments: Store in Railway volume, save URLs in PostgreSQL

**Code Structure:**
```
src/
  components/
    TasksView/
      TaskTree.tsx
      TaskRow.tsx
      AddSubtaskModal.tsx
    SummaryView/
      OverallProgress.tsx
      SprintProgressChart.tsx
    GanttView/
      GanttChart.tsx
    ChatView/
      ChatSidebar.tsx
      ConversationList.tsx
      ChatArea.tsx
      MessageList.tsx
      MessageInput.tsx
      GroupChatModal.tsx
      MemberSelector.tsx
      GroupInfoPanel.tsx
  chat/
    socket-service.ts        # WebSocket client
    chat-controller.ts       # Chat API endpoints
    chat-service.ts          # Chat business logic
```

### 7. Member Planning Feature

**Implementation:**
- Members can create subtasks under their assigned tasks (within 4-level limit)
- These act as personal planning breakdowns
- Visible to:
  - The member who created them
  - Admins
  - Anyone assigned to parent/child tasks
- Subtasks created by members count toward the 4-level nesting limit

**UI:**
- "Add Subtask" button on assigned tasks (if under level 3)
- Simple inline form (task name, details, deadline)
- Tree view shows all subtasks with proper indentation

## Security & Best Practices

### Authentication Security
- OAuth tokens stored server-side only
- Session cookies: httpOnly, secure, sameSite=strict
- CSRF tokens for all mutations
- Domain validation on both client and server

### API Security
- Rate limiting: 100 requests/15min per user (generous for 15 users)
- Input validation with Zod schemas
- XSS prevention with input sanitization
- CORS restricted to your domain

### Google Sheets Security
- Service account with minimal permissions (read/write specific sheet only)
- Never expose API keys to client
- Environment variable management for all secrets
- Sheet shared only with service account email

### Deployment Security
- Railway environment variables for secrets
- HTTPS only (Railway provides SSL)
- Security headers with Helmet.js
- Regular dependency updates with Dependabot

## Data Flow Examples

### User Views Their Tasks
```
User Request → Auth Middleware → Check User Email
                     ↓
         Query Sheets for Tasks where:
         - AssignedTo = user.email OR
         - ParentTask.AssignedTo = user.email OR
         - ChildTask.AssignedTo = user.email
                     ↓
         Build Task Tree → Return Filtered Data
```

### Admin Views All Tasks
```
Admin Request → Auth Middleware → Check Admin Role
                     ↓
         Query All Tasks from Sheets
                     ↓
         Build Complete Task Tree → Return Data
```

### Member Updates Progress
```
User Update Request → Validate Permission (assigned to user)
                     ↓
         Update Google Sheets via API
                     ↓
         Invalidate Cache → Trigger Webhook → Update All Clients
```

## Project Structure

```
project-management/
├── docs/
│   └── plans/
│       └── project-plan.md
├── server/                      # Backend (TypeScript)
│   ├── src/
│   │   ├── auth/
│   │   │   ├── passport-config.ts
│   │   │   ├── middleware.ts
│   │   │   └── rbac.ts
│   │   ├── database/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma
│   │   │   │   └── migrations/
│   │   │   └── client.ts
│   │   ├── sheets/
│   │   │   ├── client.ts
│   │   │   ├── sync-service.ts
│   │   │   └── task-mapper.ts
│   │   ├── tasks/
│   │   │   ├── controller.ts
│   │   │   ├── service.ts
│   │   │   └── validators.ts
│   │   ├── chat/
│   │   │   ├── controller.ts
│   │   │   ├── service.ts
│   │   │   └── socket-handlers.ts
│   │   ├── types/               # Shared TypeScript types
│   │   │   ├── models.ts
│   │   │   └── api.ts
│   │   ├── utils/
│   │   ├── app.ts               # Express app setup
│   │   └── server.ts            # Entry point + Socket.io
│   ├── package.json
│   └── tsconfig.json            # Backend TS config
├── client/                      # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── TasksView/
│   │   │   ├── SummaryView/
│   │   │   ├── GanttView/
│   │   │   └── ChatView/
│   │   ├── hooks/
│   │   ├── lib/                 # API client, socket client
│   │   ├── types/               # Frontend types (imports from server)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json            # Frontend TS config
│   └── vite.config.ts
├── shared/                      # Shared TypeScript code
│   ├── types/                   # Types used by both
│   ├── validators/              # Zod schemas
│   └── package.json
├── Dockerfile                   # Railway deployment
├── docker-compose.yml           # Local dev (optional)
└── .env.example
```

**TypeScript Configuration:**

**Server `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

**Client `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
SESSION_SECRET=<random-secret>

# Database (PostgreSQL on Railway)
DATABASE_URL=<postgresql-connection-string>  # Auto-provided by Railway

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://your-app.railway.app/auth/google/callback

# Google Sheets (for task sync only)
GOOGLE_SHEETS_PRIVATE_KEY=<service-account-key>
GOOGLE_SHEETS_CLIENT_EMAIL=<service-account-email>
GOOGLE_SPREADSHEET_ID=<your-sheet-id>

# Admin Configuration
ADMIN_EMAILS=admin1@servicebay.ai,admin2@servicebay.ai

# Railway
RAILWAY_STATIC_URL=<auto-provided>
```

## Development Phases

### Phase 1: Core Setup (Week 1)
- [ ] Initialize Node.js + TypeScript + Express project
- [ ] Setup React frontend with Vite
- [ ] Configure Railway deployment (Dockerfile)
- [ ] Google OAuth integration with domain restriction
- [ ] Google Sheets API integration (read/write)
- [ ] Basic authentication middleware
- [ ] Socket.io setup for WebSocket connections

### Phase 2: Data Layer & Task Management (Week 2)
- [ ] Design Google Sheets structure (Tasks, Sprints, Conversations, Messages)
- [ ] Implement Sheets sync service with polling
- [ ] Create in-memory cache layer
- [ ] Task CRUD operations
- [ ] Hierarchical task structure (4-level nesting)
- [ ] Permission system (RBAC)
- [ ] Task filtering by user

### Phase 3: Task UI & Progress Tracking (Week 3)
- [ ] Tasks view with tree structure
- [ ] Summary view with bar charts (Recharts)
- [ ] Gantt chart integration (Frappe Gantt)
- [ ] Progress tracking and updates
- [ ] CSV/Excel upload functionality
- [ ] Light/Dark theme implementation
- [ ] Responsive design

### Phase 4: Chat System (Week 4)
- [ ] Chat data structure in Google Sheets
- [ ] WebSocket event handlers (Socket.io)
- [ ] Direct messaging functionality
- [ ] Group chat creation and management
- [ ] Message CRUD operations
- [ ] Real-time message delivery
- [ ] Typing indicators
- [ ] Online/offline status

### Phase 5: Chat UI & Features (Week 5)
- [ ] Chat sidebar with conversation list
- [ ] Message thread UI
- [ ] Message input with emoji picker
- [ ] File attachments for chat
- [ ] Message reactions
- [ ] Unread message indicators
- [ ] Group member management UI
- [ ] Search conversations

### Phase 6: Testing & Deployment (Week 6)
- [ ] Unit tests (Jest)
- [ ] Integration tests (API + WebSocket)
- [ ] E2E tests (Playwright)
- [ ] Performance optimization
- [ ] Railway production deployment
- [ ] Documentation & user guide

## Testing Strategy

### Unit Tests
- Auth middleware
- Permission logic
- Data transformations
- Utility functions

### Integration Tests
- API endpoints
- Google Sheets sync
- OAuth flow

### E2E Tests
- User login flow
- Task creation/editing
- Progress updates
- View filtering

## Performance Considerations

For a 15-user team, we'll keep it simple:

1. **Caching Strategy**: 2-minute TTL for Google Sheets data
2. **Batch Operations**: Group Sheets API calls where possible
3. **Code Splitting**: React lazy loading for Gantt chart view
4. **Debouncing**: Progress updates debounced 1 second
5. **No pagination needed**: Small team = manageable data size

## Monitoring & Logging

Keep it simple for small team:

- **Application Logs**: Console logs (Railway captures them)
- **Performance**: Railway built-in metrics dashboard
- **Google Sheets API**: Monitor quota in Google Cloud Console (free tier = 100 requests/100 seconds per user)
- **Error Tracking**: Basic error logging (Sentry optional later)

## Future Enhancements (Post-MVP)

1. Task dependencies in Gantt chart
2. Email notifications for deadlines
3. Task comments/notes
4. File attachments
5. Time tracking
6. Export reports (PDF)
7. Mobile app (React Native)
8. Keyboard shortcuts
9. Task templates
10. Slack integration

## Decisions Made (Based on Your Answers)

✅ **Tech Stack**: React + Node.js + TypeScript (best for modern web apps)
✅ **Sync Method**: Simple polling every 2 minutes (easiest/fastest for 15 users)
✅ **Admin Management**: Environment variable (ADMIN_EMAILS=comma,separated,list)
✅ **Nesting Depth**: Max 4 levels (0=task, 1=subtask, 2=sub-subtask, 3=sub-sub-subtask)
✅ **UI Theme**: Light/Dark mode with modern design (shadcn/ui + Tailwind)
✅ **Task Dates**: StartDate + Deadline for Gantt chart
✅ **CSV Upload**: Syncs to Google Sheets
✅ **Google Cloud**: Will provide step-by-step setup guide

## Google Cloud Setup Guide

**Step 1: Create Google Cloud Project** (5 minutes)
1. Go to https://console.cloud.google.com
2. Click "New Project" → Name it "ServiceBay PM" → Create
3. Wait for project creation

**Step 2: Enable APIs** (2 minutes)
1. Go to "APIs & Services" → "Library"
2. Search "Google Sheets API" → Enable
3. Search "Google Drive API" → Enable (needed for Sheets access)

**Step 3: Create OAuth Credentials** (3 minutes)
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure consent screen first if prompted:
   - User type: Internal (for workspace users only)
   - App name: ServiceBay PM
   - User support email: Your email
   - Developer email: Your email
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: ServiceBay PM Web
   - Authorized redirect URIs:
     - http://localhost:3000/auth/google/callback (dev)
     - https://your-app.railway.app/auth/google/callback (prod)
5. Save Client ID and Client Secret

**Step 4: Create Service Account** (3 minutes)
1. "Credentials" → "Create Credentials" → "Service Account"
2. Name: servicebay-pm-backend
3. Click "Create and Continue"
4. Skip role assignment → Done
5. Click on the service account → "Keys" tab
6. "Add Key" → "Create new key" → JSON
7. Download the JSON file (keep it safe!)
8. Copy the service account email (looks like: servicebay-pm-backend@project-id.iam.gserviceaccount.com)

**Step 5: Share Google Sheet** (1 minute)
1. Open your Google Sheet
2. Click "Share" button
3. Paste the service account email
4. Give "Editor" permission
5. Uncheck "Notify people" → Share

**Step 6: Configure Domain Restriction** (2 minutes)
1. Go to "OAuth consent screen"
2. Under "Authorized domains" → Add "servicebay.ai"
3. Save

**Total Time: ~15 minutes**

## Estimated Timeline

With chat functionality added:

- **Week 1**: Setup + Auth + Google Sheets + WebSocket
- **Week 2**: Task management + Permissions
- **Week 3**: Task UI (Tasks, Summary, Gantt) + Theme + CSV upload
- **Week 4**: Chat backend (WebSocket, Conversations, Messages)
- **Week 5**: Chat UI (Sidebar, Messages, Groups, Reactions)
- **Week 6**: Testing + Railway deployment

**Total: ~6 weeks for production-ready MVP with chat**

## Resources & Documentation Links

- [Google Sheets API v4](https://developers.google.com/sheets/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Railway Deployment Guide](https://docs.railway.com/guides/express)
- [Frappe Gantt Documentation](https://frappe.io/gantt)
- [React Query (TanStack Query)](https://tanstack.com/query/latest)
- [Recharts Documentation](https://recharts.org/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [next-themes](https://github.com/pacocoursey/next-themes)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Socket.io Client (React)](https://socket.io/how-to/use-with-react)

---

## Summary

**What We're Building:**
A comprehensive project management and team collaboration tool for ServiceBay.ai's 15-person dev team. Uses PostgreSQL database with optional Google Sheets sync, features light/dark themes, Google OAuth login, task management, and real-time chat.

**Key Features:**
✅ Google OAuth restricted to @servicebay.ai domain
✅ **PostgreSQL database** as primary data source
✅ **Manual Google Sheets sync** for task data (button-triggered, bi-directional)
✅ 4-level task nesting (Task → Subtask → Sub-subtask → Sub-sub-subtask)
✅ Role-based permissions (Admin vs Member)
✅ Modern UI with light/dark theme
✅ Four main views: Tasks (tree), Summary (bar charts), Gantt chart, Chat
✅ CSV/Excel import that writes to PostgreSQL
✅ Member can create subtasks for planning
✅ Progress tracking with percentage
✅ Start dates + Deadlines for timeline visualization
✅ **Real-time chat with Direct Messages and Group Chats**
✅ **WebSocket-based instant messaging**
✅ **Message reactions, typing indicators, online status**
✅ **File attachments in chat**
✅ **Group chat management (create, invite, remove members)**

**Tech Stack:**
- **Language**: TypeScript (full-stack, strict mode)
- **Backend**: Node.js + Express + Socket.io + Prisma ORM
- **Frontend**: React + Vite + Tailwind + shadcn/ui
- **Database**: PostgreSQL (Railway free tier)
- **Auth**: Google OAuth 2.0 via Passport.js
- **Sheets Integration**: Google Sheets API (manual sync for tasks only)
- **Real-time**: Socket.io for WebSocket connections
- **Validation**: Zod schemas (shared between frontend/backend)
- **Deploy**: Railway (single container)
- **Charts**: Recharts (bar) + Frappe Gantt (timeline)

**Timeline:** 6 weeks for MVP with chat

**Chat Features in Detail:**
- **Direct Messages**: 1-on-1 conversations with any team member
- **Group Chats**: Create groups, set name/description, invite members
- **Real-time**: Instant message delivery via WebSocket
- **Rich Features**: Reactions, typing indicators, online status, file attachments
- **Management**: Group admins can add/remove members, delete groups
- **Privacy**: Members can only see conversations they're part of

**Next Steps:**
1. Set up Google Cloud project (~15 minutes - see guide above)
2. **Provision PostgreSQL on Railway** (~2 minutes):
   - Create new Railway project
   - Add PostgreSQL service (free tier: 512MB storage)
   - Copy DATABASE_URL from Railway dashboard
3. Start development with project scaffolding
4. Set up Prisma schema and run migrations
5. Implement core features week by week (tasks first, then chat)
6. Deploy to Railway

---

## Railway PostgreSQL Setup Guide

**Step 1: Create Railway Project** (1 minute)
1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Provision PostgreSQL"
4. Railway automatically creates database

**Step 2: Get Database URL** (30 seconds)
1. Click on PostgreSQL service
2. Go to "Variables" tab
3. Copy `DATABASE_URL` (format: postgresql://user:pass@host:port/db)
4. Add to your `.env` file

**Step 3: Configure Prisma** (1 minute)
1. Install Prisma: `npm install prisma @prisma/client`
2. Initialize: `npx prisma init`
3. Update `DATABASE_URL` in `.env`
4. Define schema in `prisma/schema.prisma`
5. Run migrations: `npx prisma migrate dev`

**Free Tier Limits:**
- ✅ 512MB storage (plenty for 15 users)
- ✅ Shared CPU
- ✅ No credit card required
- ✅ Auto-backups

**Cost:** $0/month for your use case
