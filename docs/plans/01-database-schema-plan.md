# Feature Plan: Database Schema with Prisma + PostgreSQL

## Overview
Set up the PostgreSQL database schema using Prisma ORM with proper relationships, indexes, and constraints following OWASP security best practices.

## Research Summary (2025 Best Practices)

### Prisma Relationships
- Use explicit foreign keys for PostgreSQL (default `foreignKeys` relation mode)
- Define referential actions (CASCADE, SET NULL, etc.) for data integrity
- Add indexes on foreign key fields for query performance
- Use UUID for primary keys (better for distributed systems)
- Timestamp fields for audit trails (createdAt, updatedAt)

### Security Considerations
- Row-level security (RLS) can be added later in PostgreSQL
- Never expose raw database IDs in URLs (use UUIDs)
- Soft deletes for sensitive data (isDeleted flag)
- Audit logging for sensitive operations

## Database Schema

### Core Entities

#### 1. User
- Stores authenticated users from Google OAuth
- Role-based access control (admin/member)
- Profile information from Google

#### 2. Sprint
- Project iteration container
- Has start/end dates
- Contains multiple tasks

#### 3. Task
- Self-referential (parent-child hierarchy)
- Max 4 nesting levels (enforced in application logic)
- Belongs to a sprint
- Assigned to a user
- Has progress tracking

#### 4. Conversation
- Chat conversation (DM or Group)
- DM: 2 members
- Group: 2+ members with admin

#### 5. ConversationMember
- Junction table for many-to-many
- Tracks membership and admin status

#### 6. Message
- Belongs to conversation
- Sent by user
- Supports attachments (JSON array)
- Supports reactions (JSON object)

### Relationships

```
User 1───────────────────┐
  │                      │
  │ 1:N                  │ 1:N
  │                      │
  ▼                      ▼
Sprint                 Task (self-referential)
  │                      │
  │ 1:N                  │ N:1
  │                      │
  └──────────────────────┘

User 1────────────────┐
  │                   │
  │ N:M (via table)   │ 1:N
  │                   │
  ▼                   ▼
ConversationMember  Message
  │                   │
  │ N:1               │ N:1
  │                   │
  ▼                   ▼
Conversation ─────────┘
```

## Prisma Schema Design

### Best Practices Applied

1. **UUID Primary Keys**: Better for distributed systems, no sequential leaks
2. **Timestamps**: Automatic createdAt/updatedAt for audit trails
3. **Indexes**: On foreign keys and frequently queried fields
4. **Referential Actions**: CASCADE deletes where appropriate, RESTRICT where not
5. **Enum Types**: For status fields (type-safe)
6. **JSON Fields**: For flexible data (attachments, reactions)
7. **Unique Constraints**: Prevent duplicate data
8. **Default Values**: Sensible defaults for required fields

### Validation Rules (Application Layer)

- Email: Must be @servicebay.ai domain
- Progress: 0-100 integer
- Nesting Level: 0-3 (enforced in business logic)
- File attachments: Max 5MB, whitelist extensions
- Message content: Max 10,000 characters

## Migration Strategy

1. **Initial Migration**: Create all tables
2. **Seed Data**: Create admin users, sample sprints
3. **Indexes**: Add performance indexes
4. **Constraints**: Add check constraints

## Performance Optimizations

### Indexes
- Foreign keys (automatic in PostgreSQL)
- Frequently queried fields (email, sprintId, conversationId)
- Composite indexes for common queries

### Query Optimization
- Use `select` to limit returned fields
- Use `include` sparingly (N+1 problem)
- Implement pagination for large datasets
- Use connection pooling (Prisma built-in)

## Security Measures

### Database Level
- Read-only user for reporting (future)
- Connection string in environment variables
- SSL/TLS for production connections
- Regular backups (Railway automatic)

### Application Level
- Input validation with Zod before DB operations
- Parameterized queries (Prisma automatic)
- No raw SQL queries
- Rate limiting on expensive queries

## Testing Strategy

### Unit Tests
- Model creation/validation
- Relationship integrity
- Cascade deletes

### Integration Tests
- CRUD operations
- Complex queries with joins
- Transaction handling
- Concurrency scenarios

## Rollback Plan

- Prisma migrations are reversible
- Keep backup before major schema changes
- Test migrations on staging first

## Implementation Steps

1. Define Prisma schema
2. Generate Prisma Client
3. Create initial migration
4. Run migration on local PostgreSQL
5. Create seed script
6. Write database utilities
7. Create test fixtures
8. Write integration tests

## Success Criteria

- ✅ All tables created successfully
- ✅ Foreign key relationships work
- ✅ Seed data populates correctly
- ✅ Prisma Client generates types
- ✅ CRUD operations functional
- ✅ Migrations run without errors
- ✅ Tests pass with 100% coverage
