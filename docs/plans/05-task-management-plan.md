# Task Management API - Implementation Plan

## Overview

Implement comprehensive REST API for hierarchical task management with 4-level nesting, progress tracking, sprint assignment, user permissions, and cascading operations.

## Research Summary (January 2025)

### Hierarchical Task Management Best Practices

**Nesting Depth Recommendations**:
- Maximum 3-4 levels for clarity and maintainability
- User requirement: 4-level nesting (Task → Subtask → Sub-subtask → Details)
- GitHub's approach: Dedicated sub-issues table for relationships
- Performance: Roll up completion info without traversing all children

**API Design Patterns for Nested Resources**:
- **When to use nested URLs**: Strictly hierarchical data, not too deep, relationships don't change often
- **When to avoid**: Complex relationships, frequent changes → use flat resources with filters
- **Best practice**: Support both patterns - nested for hierarchy, flat for queries
- Example: `POST /api/tasks/:id/subtasks` AND `GET /api/tasks?parentId=xxx`

**Database Design**:
- **Adjacent List Model**: Store `parentTaskId` as self-referential foreign key
- **nestingLevel field**: Track depth (0-3) for validation and queries
- **Recursive CTEs**: Modern SQL supports WITH RECURSIVE for tree queries
- **Depth validation**: Enforce maximum depth in application layer

### Cascading Updates and Progress Tracking

**Backend-First Approach** (Recommended):
- Server handles cascading updates for consistency
- Prevents inconsistency from client crashes
- Use database transactions for atomicity
- Framework support (e.g., Django ties transactions to HTTP requests)

**Parent Task Rules**:
- Parent duration based on subtasks (non-editable)
- Parent start date = earliest subtask start date
- Parent due date = latest subtask due date
- Parent progress = average of subtask progress (weighted or simple)

**Cascading Changes**:
- Modifying task dates can cascade to dependent tasks
- Delete operations cascade to subtasks (or prevent if has children)
- Status changes can propagate up to parent

### Progress Tracking Patterns

**Task Status Resources**:
- Documented possible statuses for client actions
- Poll-based: Client polls URL for progress
- WebSocket-based: Real-time notifications (optional)

**Long-Running Operations**:
- Asynchronous task execution for bulk operations
- Progress tracking endpoints
- Cancellation support

## Database Schema (Already Implemented)

```prisma
model Task {
  id             String    @id @default(uuid())
  taskName       String
  description    String?   @db.Text
  progress       Int       @default(0) // 0-100
  startDate      DateTime?
  dueDate        DateTime?
  nestingLevel   Int       @default(0) // 0-3 for 4 levels
  parentTaskId   String?   // Self-referential
  sprintId       String?
  assignedToId   String?
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  parentTask     Task?     @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subtasks       Task[]    @relation("TaskHierarchy")
  sprint         Sprint?   @relation(fields: [sprintId], references: [id])
  assignedTo     User?     @relation("AssignedTasks", fields: [assignedToId], references: [id])
  createdBy      User      @relation("CreatedTasks", fields: [createdById], references: [id])

  @@index([parentTaskId])
  @@index([sprintId])
  @@index([assignedToId])
  @@index([createdById])
  @@index([nestingLevel])
  @@index([progress])
}
```

**Key Points**:
- `nestingLevel`: 0 (top-level), 1, 2, 3 (max depth)
- `onDelete: Cascade`: Deleting parent deletes all subtasks
- Indexes on foreign keys and commonly filtered fields

## API Endpoints

### 1. List Tasks
**GET** `/api/tasks`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `sprintId` (UUID, optional) - Filter by sprint
- `assignedToId` (UUID, optional) - Filter by assignee
- `createdById` (UUID, optional) - Filter by creator
- `parentTaskId` (UUID, optional) - Filter by parent (for subtasks)
- `nestingLevel` (0-3, optional) - Filter by level
- `minProgress` (0-100, optional) - Filter by min progress
- `maxProgress` (0-100, optional) - Filter by max progress
- `includeSubtasks` (boolean, default: false) - Include full hierarchy
- `sortBy` (enum: 'createdAt' | 'dueDate' | 'progress' | 'taskName', default: 'createdAt')
- `sortOrder` (enum: 'asc' | 'desc', default: 'desc')

**Authorization**: Authenticated users (see own tasks + assigned tasks, admins see all)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "taskName": "Setup Backend",
        "description": "Configure Express server",
        "progress": 75,
        "startDate": "2025-01-15T00:00:00Z",
        "dueDate": "2025-01-20T23:59:59Z",
        "nestingLevel": 0,
        "parentTaskId": null,
        "sprintId": "sprint-uuid",
        "assignedTo": {
          "id": "user-uuid",
          "name": "John Doe"
        },
        "createdBy": {
          "id": "creator-uuid",
          "name": "Admin User"
        },
        "_count": {
          "subtasks": 3
        },
        "createdAt": "2025-01-10T10:00:00Z",
        "updatedAt": "2025-01-15T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**With Hierarchy** (`includeSubtasks=true`):
```json
{
  "id": "uuid",
  "taskName": "Setup Backend",
  "nestingLevel": 0,
  "subtasks": [
    {
      "id": "uuid",
      "taskName": "Configure Express",
      "nestingLevel": 1,
      "subtasks": [
        {
          "id": "uuid",
          "taskName": "Setup middleware",
          "nestingLevel": 2,
          "subtasks": []
        }
      ]
    }
  ]
}
```

---

### 2. Get Task by ID
**GET** `/api/tasks/:id`

**Path Parameters**:
- `id` (UUID, required)

**Query Parameters**:
- `includeSubtasks` (boolean, default: false) - Include full subtask hierarchy
- `includeParent` (boolean, default: false) - Include parent task info

**Authorization**: Task assignee, creator, or admin

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "taskName": "Configure Express",
    "description": "Setup Express server with middleware",
    "progress": 50,
    "startDate": "2025-01-15T00:00:00Z",
    "dueDate": "2025-01-18T23:59:59Z",
    "nestingLevel": 1,
    "parentTaskId": "parent-uuid",
    "sprintId": "sprint-uuid",
    "assignedTo": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@servicebay.ai"
    },
    "createdBy": {
      "id": "creator-uuid",
      "name": "Admin User"
    },
    "sprint": {
      "id": "sprint-uuid",
      "sprintName": "Sprint 1"
    },
    "_count": {
      "subtasks": 2
    },
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-15T14:30:00Z"
  }
}
```

---

### 3. Create Top-Level Task
**POST** `/api/tasks`

**Authorization**: Admin or team members (create for self)

**Request Body**:
```json
{
  "taskName": "Implement Authentication",
  "description": "Setup OAuth and session management",
  "startDate": "2025-02-01T00:00:00Z",
  "dueDate": "2025-02-10T23:59:59Z",
  "sprintId": "sprint-uuid",
  "assignedToId": "user-uuid"
}
```

**Validation Rules**:
- `taskName`: Required, 1-200 characters, trimmed
- `description`: Optional, max 5000 characters, trimmed
- `startDate`: Optional, valid ISO 8601 date
- `dueDate`: Optional, valid ISO 8601 date, must be after startDate
- `sprintId`: Optional, valid UUID, sprint must exist
- `assignedToId`: Optional, valid UUID, user must exist
- `progress`: Auto-set to 0

**Business Logic**:
- `nestingLevel` auto-set to 0
- `parentTaskId` must be null
- `createdById` set to authenticated user
- Admin can assign to anyone, members can only assign to self

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid",
    "taskName": "Implement Authentication",
    "description": "Setup OAuth and session management",
    "progress": 0,
    "startDate": "2025-02-01T00:00:00Z",
    "dueDate": "2025-02-10T23:59:59Z",
    "nestingLevel": 0,
    "parentTaskId": null,
    "sprintId": "sprint-uuid",
    "assignedToId": "user-uuid",
    "createdById": "current-user-uuid",
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T10:00:00Z"
  }
}
```

---

### 4. Create Subtask
**POST** `/api/tasks/:id/subtasks`

**Path Parameters**:
- `id` (UUID, required) - Parent task ID

**Authorization**: Parent task assignee, creator, or admin

**Request Body**:
```json
{
  "taskName": "Configure Passport.js",
  "description": "Setup Google OAuth strategy",
  "startDate": "2025-02-01T00:00:00Z",
  "dueDate": "2025-02-05T23:59:59Z",
  "assignedToId": "user-uuid"
}
```

**Validation Rules**:
- Same as create task
- `sprintId` inherited from parent (cannot override)

**Business Logic**:
1. Verify parent task exists
2. Verify parent nesting level < 3 (max depth check)
3. Set `nestingLevel` = parent's level + 1
4. Set `parentTaskId` = parent ID
5. Inherit `sprintId` from parent
6. Verify user has permission to modify parent task

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Subtask created successfully",
  "data": {
    "id": "uuid",
    "taskName": "Configure Passport.js",
    "nestingLevel": 1,
    "parentTaskId": "parent-uuid",
    "sprintId": "inherited-sprint-uuid"
  }
}
```

**Errors**:
- `400 Bad Request`: Parent at max depth (level 3)
- `403 Forbidden`: No permission to modify parent
- `404 Not Found`: Parent task not found

---

### 5. Update Task
**PUT** `/api/tasks/:id`

**Authorization**: Task assignee, creator, or admin

**Request Body** (all fields optional):
```json
{
  "taskName": "Updated Task Name",
  "description": "Updated description",
  "startDate": "2025-02-02T00:00:00Z",
  "dueDate": "2025-02-08T23:59:59Z",
  "sprintId": "new-sprint-uuid",
  "assignedToId": "new-user-uuid"
}
```

**Validation Rules**:
- At least one field required
- Cannot update: `nestingLevel`, `parentTaskId`, `createdById`, `progress` (use separate endpoint)
- Same field validations as create

**Business Logic**:
- Only admin can reassign to different user
- Cannot change sprint if task has subtasks (subtasks inherit sprint)
- Date validation: dueDate > startDate

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "id": "uuid",
    "taskName": "Updated Task Name",
    "updatedAt": "2025-01-20T15:00:00Z"
  }
}
```

---

### 6. Update Task Progress
**PATCH** `/api/tasks/:id/progress`

**Authorization**: Task assignee or admin

**Request Body**:
```json
{
  "progress": 75
}
```

**Validation Rules**:
- `progress`: Required, integer 0-100

**Business Logic**:
1. Update task progress
2. **Cascade to parent**: Recalculate parent progress as average of all subtasks
3. Recursive: Continue up the hierarchy to root
4. Log progress change

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Progress updated successfully",
  "data": {
    "id": "uuid",
    "progress": 75,
    "updatedAt": "2025-01-20T16:00:00Z"
  }
}
```

**Note**: This operation cascades up the hierarchy automatically.

---

### 7. Move Task to Different Sprint
**PATCH** `/api/tasks/:id/sprint`

**Authorization**: Admin only

**Request Body**:
```json
{
  "sprintId": "new-sprint-uuid"
}
```

**Validation Rules**:
- `sprintId`: Required, valid UUID (or null for backlog)

**Business Logic**:
1. Verify task has no subtasks (or cascade to all subtasks)
2. Update task sprint
3. If has subtasks: Update all descendants to same sprint
4. Use transaction for atomicity

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Task moved to sprint successfully",
  "data": {
    "id": "uuid",
    "sprintId": "new-sprint-uuid",
    "subtasksUpdated": 5
  }
}
```

---

### 8. Delete Task
**DELETE** `/api/tasks/:id`

**Authorization**: Admin only

**Query Parameters**:
- `cascade` (boolean, default: true) - Delete all subtasks

**Business Logic**:
1. Check if task has subtasks
2. If `cascade=true`: Delete task and all descendants (database cascade)
3. If `cascade=false` and has subtasks: Return error
4. Log deletion with user info

**Response** (204 No Content)

**Errors**:
- `400 Bad Request`: Task has subtasks and cascade=false
- `404 Not Found`: Task not found

---

### 9. Get Task Hierarchy
**GET** `/api/tasks/:id/hierarchy`

**Authorization**: Task assignee, creator, or admin

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "root": {
      "id": "root-uuid",
      "taskName": "Root Task",
      "nestingLevel": 0
    },
    "path": [
      {
        "id": "parent-uuid",
        "taskName": "Parent Task",
        "nestingLevel": 1
      }
    ],
    "current": {
      "id": "current-uuid",
      "taskName": "Current Task",
      "nestingLevel": 2
    },
    "descendants": [
      {
        "id": "child-uuid",
        "taskName": "Child Task",
        "nestingLevel": 3,
        "children": []
      }
    ]
  }
}
```

**Use Case**: Show breadcrumb navigation and full context

---

### 10. Get Task Statistics
**GET** `/api/tasks/:id/stats`

**Authorization**: Task assignee, creator, or admin

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalSubtasks": 8,
    "completedSubtasks": 5,
    "inProgressSubtasks": 3,
    "overallProgress": 62.5,
    "estimatedCompletion": "2025-02-10T23:59:59Z",
    "isOnTrack": true,
    "daysRemaining": 15
  }
}
```

---

## Validation Schemas (Zod)

### Create Task Schema
```typescript
export const createTaskSchema = z
  .object({
    taskName: z.string().min(1).max(200).trim(),
    description: z.string().max(5000).trim().optional(),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    sprintId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return data.dueDate > data.startDate;
      }
      return true;
    },
    {
      message: 'Due date must be after start date',
      path: ['dueDate'],
    }
  );
```

### Update Task Schema
```typescript
export const updateTaskSchema = createTaskSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });
```

### Update Progress Schema
```typescript
export const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
});
```

---

## Service Layer Functions

### Key Functions

**`listTasks(query, userId, isAdmin)`**:
- Build where clause from filters
- If not admin: Filter to assigned/created tasks only
- Execute parallel queries: findMany + count
- Return paginated results

**`getTaskById(id, userId, isAdmin)`**:
- Find task by ID with relations
- Verify permission (assignee, creator, or admin)
- Return task or throw error

**`createTask(data, userId, isAdmin)`**:
- Validate nesting level = 0
- Verify assignment permissions
- Create task
- Return created task

**`createSubtask(parentId, data, userId, isAdmin)`**:
- Find parent task
- Verify permission on parent
- Verify parent level < 3
- Set nesting level = parent.level + 1
- Inherit sprint from parent
- Create subtask
- Return created subtask

**`updateTask(id, data, userId, isAdmin)`**:
- Find task
- Verify permission
- Validate sprint change (no subtasks or cascade)
- Update task
- Return updated task

**`updateProgress(id, progress, userId, isAdmin)`**:
- Find task
- Verify permission
- Update progress
- **Cascade up**: Recalculate parent progress recursively
- Return updated task

**`deleteTask(id, cascade, userId)`**:
- Find task
- Verify is admin
- Check for subtasks
- If cascade: Delete (database handles cascade)
- If not cascade and has subtasks: Throw error
- Log deletion

**`getTaskHierarchy(id, userId, isAdmin)`**:
- Find task
- Verify permission
- Get ancestors (recursive query or loop)
- Get descendants (recursive query)
- Return hierarchy structure

**`getTaskStats(id, userId, isAdmin)`**:
- Find task
- Verify permission
- Count subtasks by status
- Calculate overall progress
- Estimate completion based on progress/time
- Return stats

### Helper Functions

**`calculateParentProgress(parentId)`**:
- Get all direct subtasks
- Calculate average progress
- Update parent progress
- If parent has parent: Recurse up

**`verifyTaskPermission(task, userId, isAdmin)`**:
- Return true if admin
- Return true if assignedTo matches userId
- Return true if createdBy matches userId
- Otherwise return false

**`getAllDescendants(taskId)`**:
- Recursive query to get full subtree
- Return flat list or nested structure

---

## Controller Layer

Each controller:
1. Validates input (Zod)
2. Extracts user from req.user
3. Calls service layer
4. Returns standardized response
5. Handles errors (Zod, Not Found, Forbidden)

**Example: Create Subtask**:
```typescript
async createSubtask(req: Request, res: Response, next: NextFunction) {
  try {
    const parentId = uuidSchema.parse(req.params.id);
    const data = createTaskSchema.parse(req.body);
    const userId = req.user!.id;
    const isAdmin = req.user!.role === Role.ADMIN;

    const task = await taskService.createSubtask(parentId, data, userId, isAdmin);

    res.status(201).json({
      success: true,
      message: 'Subtask created successfully',
      data: task,
    });
  } catch (error) {
    // Handle ZodError, custom errors, etc.
    next(error);
  }
}
```

---

## Routes Configuration

```typescript
import { Router } from 'express';
import { taskController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

// List and create top-level tasks
router.get('/', isAuthenticated, taskController.listTasks);
router.post('/', isAuthenticated, taskController.createTask);

// Get task by ID
router.get('/:id', isAuthenticated, taskController.getTaskById);
router.put('/:id', isAuthenticated, taskController.updateTask);
router.delete('/:id', isAuthenticated, isAdmin, taskController.deleteTask);

// Task hierarchy
router.get('/:id/hierarchy', isAuthenticated, taskController.getTaskHierarchy);
router.get('/:id/stats', isAuthenticated, taskController.getTaskStats);

// Subtasks
router.post('/:id/subtasks', isAuthenticated, taskController.createSubtask);

// Progress update
router.patch('/:id/progress', isAuthenticated, taskController.updateProgress);

// Sprint management
router.patch('/:id/sprint', isAuthenticated, isAdmin, taskController.moveToSprint);

export default router;
```

---

## Testing Strategy

### Unit Tests (Service Layer)

1. **Nesting Level Validation**:
   - Create task at each level (0-3)
   - Attempt to create level 4 (should fail)
   - Verify nesting level auto-calculation

2. **Progress Cascading**:
   - Update child progress
   - Verify parent progress recalculates
   - Test multi-level cascading

3. **Permission Checks**:
   - Admin can access all tasks
   - User can access assigned tasks
   - User can access created tasks
   - User cannot access others' tasks

4. **Sprint Inheritance**:
   - Subtask inherits parent sprint
   - Moving parent moves all subtasks

5. **Cascade Delete**:
   - Deleting parent deletes all children
   - Verify transaction rollback on error

### Integration Tests

1. **CRUD Operations**:
   - Create → Read → Update → Delete flow
   - Test all validation errors

2. **Hierarchy Operations**:
   - Create 4-level deep hierarchy
   - Get hierarchy endpoint
   - Get stats endpoint

3. **Authorization**:
   - Member creates task for self
   - Member cannot create for others (unless admin)
   - Member updates own task
   - Member cannot update others' task
   - Admin can do everything

4. **Business Logic**:
   - Progress cascading up hierarchy
   - Sprint inheritance
   - Date validation
   - Cascade delete

---

## Files to Create

1. **server/src/tasks/validators.ts** - Zod schemas
2. **server/src/tasks/service.ts** - Business logic
3. **server/src/tasks/controller.ts** - Request handlers
4. **server/src/tasks/routes.ts** - Route definitions
5. **server/src/app.ts** - Add task routes
6. **tests/feature/task-management.test.ts** - Integration tests
7. **tests/CI_CD/task-management-ci.yml** - CI/CD workflow
8. **docs/documentation/05-task-management.md** - Full documentation

---

## Security Considerations

1. **Authorization**: Verify user permissions on every operation
2. **Nesting Depth**: Enforce max depth to prevent abuse
3. **Cascade Operations**: Use transactions for atomicity
4. **Audit Logging**: Log task creation, updates, deletions
5. **Input Validation**: Zod schemas prevent injection

---

## Performance Optimizations

1. **Indexes**: Already exist on foreign keys, nestingLevel, progress
2. **Pagination**: Mandatory for list operations
3. **Selective Loading**: Use `include` only when needed
4. **Recursive Queries**: Use Prisma's nested queries efficiently
5. **Caching**: Consider caching task hierarchies (Redis)

---

## Future Enhancements

1. **Task Dependencies**: Predecessor/successor relationships
2. **Task Templates**: Predefined task structures
3. **Time Tracking**: Log hours worked on tasks
4. **Task Comments**: Discussion threads per task
5. **Task Attachments**: Link files to tasks
6. **Notifications**: Alert on task assignments/updates
7. **Gantt Integration**: Compute critical path

---

## Implementation Order

1. ✅ Research best practices
2. ✅ Create plan document
3. Create validators (validators.ts)
4. Create service layer (service.ts)
5. Create controller (controller.ts)
6. Create routes (routes.ts)
7. Add routes to app.ts
8. Create integration tests
9. Create CI/CD workflow
10. Create documentation

---

**Created**: January 2025
**Status**: Ready for Implementation
**Estimated Effort**: 6-8 hours (most complex feature)
