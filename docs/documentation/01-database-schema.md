# Database Schema Documentation

## Overview

ServiceBay PM uses PostgreSQL as the primary database with Prisma ORM for type-safe database access. The schema is designed for scalability, data integrity, and performance.

## Database Design Principles

1. **UUID Primary Keys**: Better security and distributed system support
2. **Automatic Timestamps**: All tables have `createdAt` and `updatedAt`
3. **Soft Deletes**: Important data uses `isDeleted` flag
4. **Referential Integrity**: Foreign keys with appropriate CASCADE/RESTRICT actions
5. **Indexes**: On all foreign keys and frequently queried fields
6. **Enum Types**: Type-safe status and role fields

## Tables

### User Table

Stores authenticated users from Google OAuth.

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture TEXT,
  role ENUM('ADMIN', 'MEMBER') DEFAULT 'MEMBER',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Fields:**
- `id`: UUID primary key
- `email`: Must be @servicebay.ai domain (validated in app)
- `name`: Display name from Google
- `picture`: Profile picture URL from Google
- `role`: ADMIN or MEMBER
- `isActive`: Soft delete flag
- `createdAt`: Account creation timestamp
- `updatedAt`: Last update timestamp

**Relationships:**
- One-to-Many: Tasks (as creator)
- One-to-Many: Tasks (as assignee)
- One-to-Many: Sprints (as creator)
- Many-to-Many: Conversations (via ConversationMember)
- One-to-Many: Messages

### Sprint Table

Stores project sprint information.

```sql
CREATE TABLE sprints (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('PLANNED', 'ACTIVE', 'COMPLETED') DEFAULT 'PLANNED',
  created_by_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sprints_created_by_id ON sprints(created_by_id);
CREATE INDEX idx_sprints_status ON sprints(status);
CREATE INDEX idx_sprints_dates ON sprints(start_date, end_date);
```

**Fields:**
- `id`: UUID primary key
- `name`: Sprint name (e.g., "Sprint 1", "MVP Phase")
- `startDate`: Sprint start date
- `endDate`: Sprint end date
- `status`: PLANNED, ACTIVE, or COMPLETED
- `createdById`: Creator user ID
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Relationships:**
- Many-to-One: User (creator)
- One-to-Many: Tasks

**Business Rules:**
- Start date must be before end date (validated in app)
- Cannot delete sprint with tasks (RESTRICT)

### Task Table

Stores tasks with hierarchical structure (self-referential).

```sql
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  task_name VARCHAR(255) NOT NULL,
  sprint_id VARCHAR(36) NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  parent_task_id VARCHAR(36) REFERENCES tasks(id) ON DELETE CASCADE,
  details TEXT,
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  assigned_to_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  deadline DATE NOT NULL,
  nesting_level INT DEFAULT 0 CHECK (nesting_level >= 0 AND nesting_level <= 3),
  created_by_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_assigned_to_id ON tasks(assigned_to_id);
CREATE INDEX idx_tasks_created_by_id ON tasks(created_by_id);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
```

**Fields:**
- `id`: UUID primary key
- `taskName`: Task name
- `sprintId`: Parent sprint ID
- `parentTaskId`: Parent task ID (null for top-level)
- `details`: Detailed description
- `progress`: 0-100 percentage
- `assignedToId`: Assigned user ID
- `startDate`: Task start date (for Gantt chart)
- `deadline`: Task deadline
- `nestingLevel`: 0-3 (0=task, 1=subtask, 2=sub-subtask, 3=sub-sub-subtask)
- `createdById`: Creator user ID
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Relationships:**
- Many-to-One: Sprint
- Many-to-One: User (assignee)
- Many-to-One: User (creator)
- Self-referential: Parent/Child tasks

**Business Rules:**
- Progress must be 0-100
- Nesting level must be 0-3
- Start date must be before deadline (validated in app)
- Cannot exceed 4 nesting levels (validated in app)
- Deleting sprint cascades to tasks
- Deleting task cascades to subtasks

### Conversation Table

Stores chat conversations (DM or Group).

```sql
CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('DM', 'GROUP') NOT NULL,
  name VARCHAR(255), -- NULL for DM, required for GROUP
  description TEXT,
  created_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_by_id ON conversations(created_by_id);
```

**Fields:**
- `id`: UUID primary key
- `type`: DM or GROUP
- `name`: Group name (null for DM)
- `description`: Group description (null for DM)
- `createdById`: Creator user ID
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Relationships:**
- Many-to-Many: Users (via ConversationMember)
- One-to-Many: Messages

**Business Rules:**
- DM must have exactly 2 members (validated in app)
- GROUP must have 2+ members (validated in app)
- Creator is automatically admin for GROUP

### ConversationMember Table

Junction table for Conversation-User many-to-many relationship.

```sql
CREATE TABLE conversation_members (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id ON conversation_members(user_id);
```

**Fields:**
- `id`: UUID primary key
- `conversationId`: Conversation ID
- `userId`: User ID
- `isAdmin`: Admin flag (only for GROUP)
- `joinedAt`: Timestamp when user joined

**Relationships:**
- Many-to-One: Conversation
- Many-to-One: User

**Business Rules:**
- Unique constraint on (conversationId, userId)
- Deleting conversation cascades to members
- At least one admin in GROUP (validated in app)

### Message Table

Stores chat messages.

```sql
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  attachments JSONB, -- Array: [{name, url, size}]
  reactions JSONB,   -- Object: {emoji: [userId]}
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**Fields:**
- `id`: UUID primary key
- `conversationId`: Parent conversation ID
- `senderId`: Sender user ID
- `content`: Message text
- `attachments`: JSON array of file objects
- `reactions`: JSON object of emoji reactions
- `isEdited`: Edit flag
- `isDeleted`: Soft delete flag
- `createdAt`: Send timestamp
- `updatedAt`: Last edit timestamp

**Relationships:**
- Many-to-One: Conversation
- Many-to-One: User (sender)

**Business Rules:**
- Content max 10,000 characters (validated in app)
- Can only edit own messages (validated in app)
- Can only delete own messages (validated in app)
- Soft delete preserves history

## Indexes

All indexes are created for optimal query performance:

### Primary Indexes
- All primary keys (UUID)

### Foreign Key Indexes
- All foreign key relationships

### Query Optimization Indexes
- `users.email`: Login queries
- `users.role`: Permission checks
- `sprints.status`: Active sprint queries
- `sprints(startDate, endDate)`: Date range queries
- `tasks.deadline`: Overdue task queries
- `messages.createdAt`: Message history pagination

## Data Integrity

### Referential Actions

**CASCADE**: Delete children when parent is deleted
- Sprint → Tasks
- Task → Subtasks
- Conversation → Members
- Conversation → Messages

**RESTRICT**: Prevent deletion if children exist
- User (cannot delete if has tasks/messages)
- Sprint with tasks (must reassign first)

### Constraints

**Check Constraints**:
- `tasks.progress`: 0-100
- `tasks.nestingLevel`: 0-3

**Unique Constraints**:
- `users.email`
- `conversation_members(conversationId, userId)`

### Default Values

- Timestamps: `NOW()`
- Booleans: `false` or `true` as appropriate
- Status: Initial state (PLANNED, MEMBER, etc.)

## Performance Considerations

### Connection Pooling
Prisma includes built-in connection pooling (default 10 connections).

### Query Optimization
- Use `select` to limit fields
- Use `include` carefully (N+1 problem)
- Implement pagination for large datasets
- Use `findFirst` instead of `findMany()[0]`

### Caching Strategy
- No application-level caching for 15 users
- Database query cache (PostgreSQL built-in)
- Result caching in React Query (frontend)

## Migrations

### Running Migrations

```bash
# Development
npx prisma migrate dev --name migration_name

# Production
npx prisma migrate deploy
```

### Migration Strategy

1. **Create migration**: `prisma migrate dev`
2. **Review SQL**: Check generated SQL file
3. **Test locally**: Run on local database
4. **Apply to staging**: Test on staging environment
5. **Apply to production**: Run `migrate deploy`

### Rollback

Prisma migrations are sequential. To rollback:
1. Create a new migration that reverses changes
2. Or restore from database backup

## Backup & Recovery

### Railway Automatic Backups
- Daily backups (free tier)
- Point-in-time recovery
- Download backup via Railway CLI

### Manual Backup
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Restore
```bash
psql $DATABASE_URL < backup.sql
```

## Security

### Database Level
- SSL/TLS connections (Railway default)
- Limited user permissions
- No raw SQL queries (Prisma only)
- Parameterized queries (SQL injection protection)

### Application Level
- Input validation (Zod)
- Output sanitization
- Rate limiting on queries
- Audit logging for sensitive operations

## Monitoring

### Metrics to Track
- Query performance (slow query log)
- Connection pool usage
- Database size growth
- Index usage statistics

### Tools
- Railway metrics dashboard
- Prisma Studio (dev tool)
- PostgreSQL `pg_stat_statements`

## Future Enhancements

- Row-level security (RLS)
- Audit log table
- Full-text search (PostgreSQL FTS)
- Materialized views for reporting
- Read replicas for scaling
