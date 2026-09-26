# Task Management API Documentation

## Overview

The Task Management API provides comprehensive endpoints for managing hierarchical tasks in ServiceBay PM. It implements a 4-level nesting system (Task → Subtask → Sub-subtask → Detail level), automatic progress cascading, sprint inheritance, role-based access control (RBAC), and cascading operations. The API supports complex workflows including task hierarchies, progress tracking, sprint assignment, and team collaboration.

## Architecture

### Layer Structure

```
┌─────────────────────────────────────────┐
│         Routes Layer                     │
│  (routes.ts - HTTP endpoints)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Controller Layer                   │
│  (controller.ts - Request handling)      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Service Layer                     │
│  (service.ts - Business logic)           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Database Layer                     │
│  (Prisma ORM - Data access)              │
└─────────────────────────────────────────┘
```

### Components

1. **Validators** (`validators.ts`): Input validation using Zod schemas
2. **Service** (`service.ts`): Business logic, hierarchy management, and progress cascading
3. **Controller** (`controller.ts`): Request/response handling and error management
4. **Routes** (`routes.ts`): RESTful endpoint definitions with authorization

### Hierarchical Data Model

```
Task (Level 0 - nestingLevel: 0)
├── Subtask (Level 1 - nestingLevel: 1)
│   ├── Sub-subtask (Level 2 - nestingLevel: 2)
│   │   └── Detail (Level 3 - nestingLevel: 3) [MAX DEPTH]
│   └── Sub-subtask (Level 2)
└── Subtask (Level 1)
```

**Key Relationships**:
- **parentTaskId**: Self-referential foreign key linking child to parent
- **nestingLevel**: Integer (0-3) tracking depth in hierarchy
- **sprintId**: Inherited from parent, cannot be overridden in subtasks
- **Cascade Delete**: Deleting parent removes entire subtree atomically
- **Progress Propagation**: Child progress changes recalculate parent progress recursively

## API Endpoints

### Base URL
```
/api/tasks
```

### Authentication
All endpoints require authentication. Include session cookie in requests.

---

### 1. List Tasks

**GET** `/api/tasks`

List all tasks with extensive filtering, sorting, and pagination. Non-admin users see only tasks they created or are assigned to.

**Authorization**: All authenticated users (permission-filtered)

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 20 | Items per page (min: 1, max: 100) |
| sprintId | UUID | No | - | Filter by sprint (use null string for backlog) |
| assignedToId | UUID | No | - | Filter by assignee |
| createdById | UUID | No | - | Filter by creator |
| parentTaskId | UUID | No | - | Filter by parent task (subtasks only) |
| nestingLevel | number | No | - | Filter by nesting level (0-3) |
| minProgress | number | No | - | Minimum progress (0-100) |
| maxProgress | number | No | - | Maximum progress (0-100) |
| includeSubtasks | boolean | No | false | Include full subtask hierarchy |
| sortBy | enum | No | createdAt | Sort field (createdAt, dueDate, progress, taskName) |
| sortOrder | enum | No | desc | Sort order (asc, desc) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "taskName": "Setup Backend Infrastructure",
        "description": "Configure Express server with middleware",
        "progress": 75,
        "startDate": "2025-01-15T00:00:00Z",
        "dueDate": "2025-01-20T23:59:59Z",
        "nestingLevel": 0,
        "parentTaskId": null,
        "sprintId": "sprint-uuid",
        "assignedToId": "user-uuid",
        "createdById": "creator-uuid",
        "createdAt": "2025-01-10T10:00:00Z",
        "updatedAt": "2025-01-15T14:30:00Z",
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
          "subtasks": 3
        }
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

**With Full Hierarchy** (`includeSubtasks=true`):
```json
{
  "id": "uuid",
  "taskName": "Setup Backend",
  "nestingLevel": 0,
  "progress": 67,
  "subtasks": [
    {
      "id": "uuid",
      "taskName": "Configure Express",
      "nestingLevel": 1,
      "progress": 80,
      "subtasks": [
        {
          "id": "uuid",
          "taskName": "Setup middleware",
          "nestingLevel": 2,
          "progress": 90,
          "subtasks": [
            {
              "id": "uuid",
              "taskName": "Add security headers",
              "nestingLevel": 3,
              "progress": 100,
              "subtasks": []
            }
          ]
        }
      ]
    },
    {
      "id": "uuid",
      "taskName": "Setup Database",
      "nestingLevel": 1,
      "progress": 50,
      "subtasks": []
    }
  ]
}
```

**Permission Filtering**:
- **Admin**: Sees all tasks in the system
- **Member**: Sees only tasks where `assignedToId` or `createdById` matches their user ID

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `400 Bad Request`: Invalid query parameters

**Example Requests**:

Get all top-level tasks in a sprint:
```bash
curl -X GET "http://localhost:3000/api/tasks?sprintId=123e4567-e89b-12d3-a456-426614174000&nestingLevel=0&page=1&limit=20" \
  -H "Cookie: connect.sid=session-id"
```

Get tasks assigned to a user with high progress:
```bash
curl -X GET "http://localhost:3000/api/tasks?assignedToId=user-uuid&minProgress=80&sortBy=dueDate&sortOrder=asc" \
  -H "Cookie: connect.sid=session-id"
```

Get backlog tasks (no sprint):
```bash
curl -X GET "http://localhost:3000/api/tasks?sprintId=null&nestingLevel=0" \
  -H "Cookie: connect.sid=session-id"
```

Get task with full hierarchy:
```bash
curl -X GET "http://localhost:3000/api/tasks?parentTaskId=parent-uuid&includeSubtasks=true" \
  -H "Cookie: connect.sid=session-id"
```

---

### 2. Get Task by ID

**GET** `/api/tasks/:id`

Get detailed information about a specific task.

**Authorization**: Task assignee, creator, or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| includeSubtasks | boolean | No | false | Include full subtask hierarchy |
| includeParent | boolean | No | false | Include parent task information |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "taskName": "Configure Express Server",
    "description": "Setup Express with middleware, routes, and error handling",
    "progress": 50,
    "startDate": "2025-01-15T00:00:00Z",
    "dueDate": "2025-01-18T23:59:59Z",
    "nestingLevel": 1,
    "parentTaskId": "parent-uuid",
    "sprintId": "sprint-uuid",
    "assignedToId": "user-uuid",
    "createdById": "creator-uuid",
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-15T14:30:00Z",
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
    }
  }
}
```

**With Parent** (`includeParent=true`):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "taskName": "Configure Express Server",
    "nestingLevel": 1,
    "parentTask": {
      "id": "parent-uuid",
      "taskName": "Setup Backend Infrastructure",
      "nestingLevel": 0
    },
    "_count": {
      "subtasks": 2
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: No permission to access this task
- `400 Bad Request`: Invalid UUID format
- `404 Not Found`: Task does not exist

**Example Requests**:
```bash
# Get task with subtasks
curl -X GET "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000?includeSubtasks=true" \
  -H "Cookie: connect.sid=session-id"

# Get task with parent context
curl -X GET "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000?includeParent=true" \
  -H "Cookie: connect.sid=session-id"
```

---

### 3. Create Top-Level Task

**POST** `/api/tasks`

Create a new top-level task (nestingLevel: 0). Members can create tasks for themselves, admins can assign to anyone.

**Authorization**: All authenticated users

**Request Body**:
```json
{
  "taskName": "Implement Authentication",
  "description": "Setup OAuth 2.0 and session management",
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
- `sprintId`: Optional, valid UUID, sprint must exist (null for backlog)
- `assignedToId`: Optional, valid UUID, user must exist

**Business Logic**:
- `nestingLevel` automatically set to 0
- `parentTaskId` set to null
- `progress` initialized to 0
- `createdById` set to authenticated user ID
- **Permission Check**: Members can only assign to themselves, admins can assign to anyone

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid",
    "taskName": "Implement Authentication",
    "description": "Setup OAuth 2.0 and session management",
    "progress": 0,
    "startDate": "2025-02-01T00:00:00Z",
    "dueDate": "2025-02-10T23:59:59Z",
    "nestingLevel": 0,
    "parentTaskId": null,
    "sprintId": "sprint-uuid",
    "assignedToId": "user-uuid",
    "createdById": "current-user-uuid",
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T10:00:00Z",
    "assignedTo": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@servicebay.ai"
    },
    "createdBy": {
      "id": "current-user-uuid",
      "name": "Current User"
    }
  }
}
```

**Audit Log**: Task creation is logged:
```
Task created: "Implement Authentication" (uuid) by user@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Member trying to assign to another user
- `400 Bad Request`: Validation errors or invalid date range
- `404 Not Found`: Sprint or assigned user not found

**Validation Error Example**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "path": ["taskName"],
      "message": "Task name is required"
    },
    {
      "code": "custom",
      "path": ["dueDate"],
      "message": "Due date must be after start date"
    }
  ]
}
```

**Example Requests**:

Create task assigned to self (member):
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Implement Login Form",
    "description": "Create responsive login UI with validation",
    "startDate": "2025-02-01T00:00:00Z",
    "dueDate": "2025-02-05T23:59:59Z",
    "sprintId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

Create task in backlog (no sprint):
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Research New Framework",
    "description": "Evaluate potential framework options"
  }'
```

Admin assigns task to another user:
```bash
curl -X POST "http://localhost:3000/api/tasks" \
  -H "Cookie: connect.sid=admin-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Code Review",
    "assignedToId": "other-user-uuid",
    "sprintId": "sprint-uuid"
  }'
```

---

### 4. Create Subtask

**POST** `/api/tasks/:id/subtasks`

Create a subtask under a parent task. Subtasks inherit sprint from parent and increment nesting level.

**Authorization**: Parent task assignee, creator, or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Parent task ID |

**Request Body**:
```json
{
  "taskName": "Configure Passport.js",
  "description": "Setup Google OAuth strategy with Passport",
  "startDate": "2025-02-01T00:00:00Z",
  "dueDate": "2025-02-05T23:59:59Z",
  "assignedToId": "user-uuid"
}
```

**Validation Rules**:
- Same as create task
- `sprintId` field is **ignored** (inherited from parent automatically)

**Business Logic**:
1. Verify parent task exists
2. Verify user has permission on parent (assignee, creator, or admin)
3. Verify parent nesting level < 3 (enforce max depth of 4 levels)
4. Set `nestingLevel` = parent.nestingLevel + 1
5. Set `parentTaskId` = parent ID
6. Inherit `sprintId` from parent (cannot override)
7. Set `createdById` to authenticated user
8. Initialize `progress` to 0

**Nesting Depth Enforcement**:
```
Level 0 (Top-level) → Can create subtask
Level 1 (Subtask) → Can create subtask
Level 2 (Sub-subtask) → Can create subtask
Level 3 (Detail) → CANNOT create subtask (max depth reached)
```

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Subtask created successfully",
  "data": {
    "id": "uuid",
    "taskName": "Configure Passport.js",
    "description": "Setup Google OAuth strategy with Passport",
    "progress": 0,
    "startDate": "2025-02-01T00:00:00Z",
    "dueDate": "2025-02-05T23:59:59Z",
    "nestingLevel": 1,
    "parentTaskId": "parent-uuid",
    "sprintId": "inherited-sprint-uuid",
    "assignedToId": "user-uuid",
    "createdById": "current-user-uuid",
    "createdAt": "2025-01-20T10:30:00Z",
    "updatedAt": "2025-01-20T10:30:00Z",
    "assignedTo": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@servicebay.ai"
    },
    "createdBy": {
      "id": "current-user-uuid",
      "name": "Current User"
    },
    "parentTask": {
      "id": "parent-uuid",
      "taskName": "Implement Authentication",
      "nestingLevel": 0
    }
  }
}
```

**Audit Log**: Subtask creation is logged:
```
Subtask created: "Configure Passport.js" (uuid) under parent parent-uuid by user@servicebay.ai
```

**Error Responses**:
- `400 Bad Request`: Parent at max depth (level 3) or validation errors
- `403 Forbidden`: No permission to modify parent task or assign to other user
- `404 Not Found`: Parent task or assigned user not found

**Max Depth Error**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Maximum nesting depth (4 levels) reached. Cannot create subtask."
}
```

**Example Requests**:

Create subtask under parent:
```bash
curl -X POST "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/subtasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Add Login Validation",
    "description": "Validate email format and password strength",
    "assignedToId": "user-uuid"
  }'
```

Create multi-level hierarchy:
```bash
# Level 0 task
TASK_ID=$(curl -X POST "http://localhost:3000/api/tasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"taskName": "Backend Setup"}' | jq -r '.data.id')

# Level 1 subtask
SUBTASK_ID=$(curl -X POST "http://localhost:3000/api/tasks/$TASK_ID/subtasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"taskName": "Express Config"}' | jq -r '.data.id')

# Level 2 sub-subtask
curl -X POST "http://localhost:3000/api/tasks/$SUBTASK_ID/subtasks" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"taskName": "Setup Middleware"}'
```

---

### 5. Update Task

**PUT** `/api/tasks/:id`

Update an existing task. Cannot modify hierarchy structure (nestingLevel, parentTaskId).

**Authorization**: Task assignee, creator, or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body** (all fields optional):
```json
{
  "taskName": "Updated Task Name",
  "description": "Updated description with more details",
  "startDate": "2025-02-02T00:00:00Z",
  "dueDate": "2025-02-08T23:59:59Z",
  "sprintId": "new-sprint-uuid",
  "assignedToId": "new-user-uuid"
}
```

**Validation Rules**:
- At least one field required for update
- **Cannot update**: `nestingLevel`, `parentTaskId`, `createdById`, `progress` (use PATCH /progress)
- Same field validations as create
- Date validation: dueDate > startDate

**Business Logic**:
- Only admin can reassign to different user
- **Sprint Change Restriction**: Cannot change sprint if task has subtasks (prevents inconsistency)
  - Use `PATCH /api/tasks/:id/sprint` endpoint to move task with all subtasks
- Date changes do not cascade to subtasks
- Verify sprint and user exist if provided

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "id": "uuid",
    "taskName": "Updated Task Name",
    "description": "Updated description with more details",
    "progress": 50,
    "startDate": "2025-02-02T00:00:00Z",
    "dueDate": "2025-02-08T23:59:59Z",
    "nestingLevel": 1,
    "parentTaskId": "parent-uuid",
    "sprintId": "new-sprint-uuid",
    "assignedToId": "new-user-uuid",
    "createdById": "creator-uuid",
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-20T15:00:00Z",
    "assignedTo": {
      "id": "new-user-uuid",
      "name": "Jane Doe",
      "email": "jane@servicebay.ai"
    },
    "createdBy": {
      "id": "creator-uuid",
      "name": "Creator User"
    }
  }
}
```

**Audit Log**: Task updates are logged:
```
Task updated: "Updated Task Name" (uuid) by user@servicebay.ai
```

**Error Responses**:
- `400 Bad Request`: Validation errors, invalid date range, or sprint change with subtasks
- `403 Forbidden`: No permission or member trying to reassign to another user
- `404 Not Found`: Task, sprint, or assigned user not found

**Sprint Change Error**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Cannot change sprint of task with subtasks. Move subtasks first or use move-to-sprint endpoint."
}
```

**Example Requests**:

Update task name and description:
```bash
curl -X PUT "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Implement Advanced Authentication",
    "description": "Add OAuth 2.0, 2FA, and session management"
  }'
```

Update dates:
```bash
curl -X PUT "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-02-05T00:00:00Z",
    "dueDate": "2025-02-15T23:59:59Z"
  }'
```

Admin reassigns task:
```bash
curl -X PUT "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=admin-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedToId": "other-user-uuid"
  }'
```

---

### 6. Update Task Progress

**PATCH** `/api/tasks/:id/progress`

Update task progress with automatic cascading to parent tasks. When a child task progress changes, all ancestor tasks recalculate their progress as the average of their direct subtasks.

**Authorization**: Task assignee or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body**:
```json
{
  "progress": 75
}
```

**Validation Rules**:
- `progress`: Required, integer 0-100

**Business Logic - Progress Cascading Algorithm**:
1. Update task progress to specified value
2. If task has parent:
   - Find all direct siblings (tasks with same parent)
   - Calculate average progress of all siblings
   - Update parent progress to rounded average
   - Recursively repeat for parent's parent up to root

**Cascading Example**:
```
Before:
- Task A (Level 0): progress = 50
  ├── Task B (Level 1): progress = 60
  │   ├── Task D (Level 2): progress = 70
  │   └── Task E (Level 2): progress = 50  ← UPDATE TO 90
  └── Task C (Level 1): progress = 40

After updating Task E to 90:
1. Task E: 90 (direct update)
2. Task B: (70 + 90) / 2 = 80 (recalculated from children)
3. Task A: (80 + 40) / 2 = 60 (recalculated from children)

Result:
- Task A (Level 0): progress = 60
  ├── Task B (Level 1): progress = 80
  │   ├── Task D (Level 2): progress = 70
  │   └── Task E (Level 2): progress = 90
  └── Task C (Level 1): progress = 40
```

**Response**: `200 OK`
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

**Audit Log**: Progress updates are logged:
```
Task progress updated: uuid to 75% by user@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not assignee or admin
- `400 Bad Request`: Invalid progress value (not 0-100)
- `404 Not Found`: Task does not exist

**Example Requests**:

Mark task as in progress:
```bash
curl -X PATCH "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/progress" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"progress": 25}'
```

Mark task as completed:
```bash
curl -X PATCH "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/progress" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"progress": 100}'
```

Update progress with cascade visualization:
```bash
# Update child task and observe parent recalculation
curl -X PATCH "http://localhost:3000/api/tasks/child-uuid/progress" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"progress": 80}'

# Get parent task to see cascaded progress
curl -X GET "http://localhost:3000/api/tasks/parent-uuid" \
  -H "Cookie: connect.sid=session-id"
```

---

### 7. Move Task to Sprint

**PATCH** `/api/tasks/:id/sprint`

Move task and all its descendants to a different sprint. Ensures sprint consistency across entire subtree.

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body**:
```json
{
  "sprintId": "new-sprint-uuid"
}
```

**Validation Rules**:
- `sprintId`: Required, valid UUID or null (for backlog)
- Sprint must exist if not null

**Business Logic - Cascade Move Algorithm**:
1. Verify user is admin
2. Find task and verify it exists
3. Verify target sprint exists (if not null)
4. Recursively collect all descendant task IDs
5. In single database transaction:
   - Update all descendants' sprintId
   - Update task's sprintId
6. Return task and count of updated subtasks

**Why Cascade?**
- Prevents sprint inheritance inconsistency
- Subtasks always inherit parent's sprint
- Moving parent must move entire subtree atomically

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Task moved to sprint successfully",
  "data": {
    "task": {
      "id": "uuid",
      "taskName": "Backend Infrastructure",
      "sprintId": "new-sprint-uuid",
      "nestingLevel": 0,
      "updatedAt": "2025-01-20T17:00:00Z"
    },
    "subtasksUpdated": 5
  }
}
```

**Audit Log**: Sprint moves are logged:
```
Task moved to sprint: task-uuid to sprint-uuid (5 subtasks) by admin@servicebay.ai
```

**Use Cases**:
- Move completed task from active sprint to next sprint
- Move unfinished tasks to backlog during sprint retrospective
- Reorganize task hierarchy across sprints
- Move entire feature (with all subtasks) between sprints

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid sprint ID
- `404 Not Found`: Task or sprint not found

**Example Requests**:

Move task to different sprint:
```bash
curl -X PATCH "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/sprint" \
  -H "Cookie: connect.sid=admin-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sprintId": "new-sprint-uuid"
  }'
```

Move task to backlog (no sprint):
```bash
curl -X PATCH "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/sprint" \
  -H "Cookie: connect.sid=admin-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sprintId": null
  }'
```

Batch move workflow:
```bash
# Get all tasks from old sprint
OLD_SPRINT_TASKS=$(curl -X GET "http://localhost:3000/api/tasks?sprintId=old-sprint-uuid&nestingLevel=0" \
  -H "Cookie: connect.sid=admin-session-id" | jq -r '.data.tasks[].id')

# Move each top-level task (subtasks move automatically)
for TASK_ID in $OLD_SPRINT_TASKS; do
  curl -X PATCH "http://localhost:3000/api/tasks/$TASK_ID/sprint" \
    -H "Cookie: connect.sid=admin-session-id" \
    -H "Content-Type: application/json" \
    -d '{"sprintId": "new-sprint-uuid"}'
done
```

---

### 8. Delete Task

**DELETE** `/api/tasks/:id`

Delete a task with optional cascade to all subtasks. Uses database-level cascade delete for atomicity.

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cascade | boolean | No | true | Delete all subtasks (recommended) |

**Business Logic - Cascade Delete**:
1. Verify user is admin
2. Find task and verify it exists
3. Check if task has subtasks
4. If `cascade=true` (default): Delete task (database CASCADE handles subtasks)
5. If `cascade=false` and has subtasks: Return error
6. Log deletion with audit trail

**Database Cascade**:
```prisma
model Task {
  parentTask Task? @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: Cascade)
}
```
When parent is deleted, database automatically deletes all descendants.

**Response**: `204 No Content`

**Audit Log**: Deletions are logged:
```
Task deleted: task-uuid (cascade=true) by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid UUID or task has subtasks with cascade=false
- `404 Not Found`: Task does not exist

**Subtask Conflict Error**:
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Task has 5 subtasks. Use cascade=true to delete all subtasks."
}
```

**Example Requests**:

Delete task with cascade (default):
```bash
curl -X DELETE "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=admin-session-id"
```

Delete task without cascade (fails if has subtasks):
```bash
curl -X DELETE "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000?cascade=false" \
  -H "Cookie: connect.sid=admin-session-id"
```

Safe delete workflow:
```bash
# Check if task has subtasks before deleting
TASK=$(curl -X GET "http://localhost:3000/api/tasks/task-uuid" \
  -H "Cookie: connect.sid=admin-session-id")

SUBTASK_COUNT=$(echo $TASK | jq -r '.data._count.subtasks')

if [ "$SUBTASK_COUNT" -gt 0 ]; then
  echo "Warning: Task has $SUBTASK_COUNT subtasks"
  read -p "Delete all subtasks? (y/n) " -n 1 -r
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    curl -X DELETE "http://localhost:3000/api/tasks/task-uuid?cascade=true" \
      -H "Cookie: connect.sid=admin-session-id"
  fi
else
  curl -X DELETE "http://localhost:3000/api/tasks/task-uuid" \
    -H "Cookie: connect.sid=admin-session-id"
fi
```

---

### 9. Get Task Hierarchy

**GET** `/api/tasks/:id/hierarchy`

Get complete hierarchy context for a task: ancestors (path to root), current task, and descendants (full subtree).

**Authorization**: Task assignee, creator, or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "root": {
      "id": "root-uuid",
      "taskName": "Backend Infrastructure",
      "nestingLevel": 0
    },
    "path": [
      {
        "id": "parent-uuid",
        "taskName": "Express Configuration",
        "nestingLevel": 1
      }
    ],
    "current": {
      "id": "current-uuid",
      "taskName": "Setup Middleware",
      "nestingLevel": 2,
      "progress": 75
    },
    "descendants": [
      {
        "id": "child-uuid",
        "taskName": "Add Security Headers",
        "nestingLevel": 3,
        "progress": 100,
        "children": []
      },
      {
        "id": "child2-uuid",
        "taskName": "Add CORS",
        "nestingLevel": 3,
        "progress": 50,
        "children": []
      }
    ]
  }
}
```

**Data Structure**:
- **root**: Top-most ancestor (nestingLevel: 0)
- **path**: Array of ancestors from root to current task (excluding root and current)
- **current**: The requested task
- **descendants**: Recursive tree of all child tasks

**Use Cases**:
- Display breadcrumb navigation
- Show task context in detail view
- Visualize complete task hierarchy
- Export task structure
- Generate reports with full context

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: No permission to view task
- `400 Bad Request`: Invalid UUID
- `404 Not Found`: Task does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/hierarchy" \
  -H "Cookie: connect.sid=session-id"
```

**Example Response for Multi-Level Task**:
```json
{
  "success": true,
  "data": {
    "root": {
      "id": "level0-uuid",
      "taskName": "Project Alpha",
      "nestingLevel": 0
    },
    "path": [
      {
        "id": "level1-uuid",
        "taskName": "Backend Development",
        "nestingLevel": 1
      },
      {
        "id": "level2-uuid",
        "taskName": "API Endpoints",
        "nestingLevel": 2
      }
    ],
    "current": {
      "id": "level3-uuid",
      "taskName": "User Authentication Endpoint",
      "nestingLevel": 3,
      "progress": 80
    },
    "descendants": []
  }
}
```

---

### 10. Get Task Statistics

**GET** `/api/tasks/:id/stats`

Get comprehensive statistics about a task including subtask completion, progress analysis, timeline estimates, and on-track status.

**Authorization**: Task assignee, creator, or admin

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Response**: `200 OK`
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

**Statistics Explained**:

| Statistic | Description | Calculation |
|-----------|-------------|-------------|
| totalSubtasks | Count of all descendants | Recursive count of entire subtree |
| completedSubtasks | Tasks at 100% progress | Count where progress = 100 |
| inProgressSubtasks | Tasks between 1-99% | Count where 0 < progress < 100 |
| overallProgress | Average progress of all subtasks | Sum(subtask.progress) / totalSubtasks |
| estimatedCompletion | Projected completion date | Based on velocity (progress per day) |
| isOnTrack | Whether on schedule | actualProgress >= expectedProgress |
| daysRemaining | Days until due date | (dueDate - now) in days |

**On-Track Calculation**:
```
totalDays = dueDate - startDate
elapsedDays = now - startDate
expectedProgress = (elapsedDays / totalDays) * 100

isOnTrack = overallProgress >= expectedProgress
```

**Velocity-Based Estimation**:
```
velocity = overallProgress / elapsedDays  // % per day
remainingProgress = 100 - overallProgress
estimatedDays = remainingProgress / velocity
estimatedCompletion = now + estimatedDays
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: No permission to view task
- `400 Bad Request`: Invalid UUID
- `404 Not Found`: Task does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/stats" \
  -H "Cookie: connect.sid=session-id"
```

**Use Cases**:
- Project dashboards showing completion metrics
- Sprint burndown charts
- Task health indicators
- Progress reports
- Velocity tracking
- Timeline predictions

**Example Response - Behind Schedule**:
```json
{
  "success": true,
  "data": {
    "totalSubtasks": 12,
    "completedSubtasks": 3,
    "inProgressSubtasks": 6,
    "overallProgress": 35.5,
    "estimatedCompletion": "2025-02-28T23:59:59Z",
    "isOnTrack": false,
    "daysRemaining": 10
  }
}
```

---

## Hierarchical Task Model

### 4-Level Nesting Structure

ServiceBay PM implements a strict 4-level task hierarchy to maintain clarity while supporting detailed task breakdown:

```
Level 0: Top-Level Tasks (nestingLevel: 0)
  └─ Major features, epics, or project phases
     Example: "Implement User Authentication System"

Level 1: Subtasks (nestingLevel: 1)
  └─ Component-level work items
     Example: "Setup OAuth 2.0 Integration"

Level 2: Sub-subtasks (nestingLevel: 2)
  └─ Detailed implementation tasks
     Example: "Configure Google OAuth Provider"

Level 3: Detail Tasks (nestingLevel: 3) [MAX DEPTH]
  └─ Granular work items (cannot have children)
     Example: "Add redirect URI to Google Console"
```

### Parent-Child Relationships

**Database Schema**:
```prisma
model Task {
  id             String    @id @default(uuid())
  parentTaskId   String?   // Self-referential FK
  nestingLevel   Int       @default(0) // 0-3

  // Relations
  parentTask     Task?     @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subtasks       Task[]    @relation("TaskHierarchy")

  @@index([parentTaskId])
  @@index([nestingLevel])
}
```

**Key Constraints**:
1. **Top-level tasks**: `parentTaskId = null`, `nestingLevel = 0`
2. **Subtasks**: `parentTaskId = parent.id`, `nestingLevel = parent.nestingLevel + 1`
3. **Max depth**: Cannot create subtask when `nestingLevel = 3`
4. **Cascade delete**: Deleting parent deletes entire subtree
5. **Sprint inheritance**: Subtasks inherit `sprintId` from parent

### nestingLevel Field

The `nestingLevel` field is critical for:

1. **Depth Validation**: Enforce 4-level limit at API layer
2. **Efficient Queries**: Filter by level without recursive queries
3. **UI Rendering**: Determine indentation and visual hierarchy
4. **Permission Checks**: Apply level-specific rules
5. **Performance**: Index allows fast level-based filtering

**Automatic Calculation**:
- Top-level task: `nestingLevel = 0`
- Subtask: `nestingLevel = parent.nestingLevel + 1`
- Cannot be manually set or modified

---

## Progress Cascading Logic

### Automatic Parent Progress Recalculation

When a task's progress is updated, the change automatically propagates up the hierarchy to all ancestor tasks. This ensures parent progress always reflects the average completion of its children.

### Cascading Algorithm

**Step-by-Step Process**:

1. **Update Child**: Set child task progress to new value
2. **Find Parent**: If child has `parentTaskId`, proceed to step 3
3. **Get Siblings**: Query all tasks with same `parentTaskId`
4. **Calculate Average**: `parentProgress = sum(siblings.progress) / siblings.length`
5. **Update Parent**: Set parent progress to rounded average
6. **Recurse**: If parent has `parentTaskId`, repeat from step 2

**Implementation**:
```typescript
private async recalculateParentProgress(parentId: string) {
  // Get all direct subtasks
  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: parentId },
    select: { progress: true }
  });

  if (subtasks.length === 0) return;

  // Calculate average progress
  const averageProgress =
    subtasks.reduce((sum, task) => sum + task.progress, 0) / subtasks.length;

  // Update parent progress
  const parent = await prisma.task.update({
    where: { id: parentId },
    data: { progress: Math.round(averageProgress) }
  });

  // Recurse up the hierarchy
  if (parent.parentTaskId) {
    await this.recalculateParentProgress(parent.parentTaskId);
  }
}
```

### Detailed Example

**Initial State**:
```
Task A (Level 0) - progress: 0
├── Task B (Level 1) - progress: 0
│   ├── Task D (Level 2) - progress: 0
│   └── Task E (Level 2) - progress: 0
└── Task C (Level 1) - progress: 0
```

**Update Sequence**:

**1. Update Task D to 100%**:
```
Task A: 0 → 25
├── Task B: 0 → 50  (avg of D:100, E:0)
│   ├── Task D: 0 → 100
│   └── Task E: 0
└── Task C: 0
```
Calculation: B = (100+0)/2 = 50, A = (50+0)/2 = 25

**2. Update Task E to 60%**:
```
Task A: 25 → 40
├── Task B: 50 → 80  (avg of D:100, E:60)
│   ├── Task D: 100
│   └── Task E: 0 → 60
└── Task C: 0
```
Calculation: B = (100+60)/2 = 80, A = (80+0)/2 = 40

**3. Update Task C to 40%**:
```
Task A: 40 → 60
├── Task B: 80
│   ├── Task D: 100
│   └── Task E: 60
└── Task C: 0 → 40
```
Calculation: A = (80+40)/2 = 60

### Recursive Propagation

The algorithm recursively propagates changes to the root:

```
Level 3 Task Updated
       ↓
Level 2 Parent Recalculated
       ↓
Level 1 Parent Recalculated
       ↓
Level 0 Root Recalculated
```

**Benefits**:
- Parent progress always reflects children
- No manual recalculation needed
- Real-time progress visibility
- Accurate project completion estimates

**Performance Considerations**:
- Single database query per level
- Maximum 4 levels = maximum 4 queries
- Updates are sequential but fast
- Could optimize with batch updates in future

---

## Sprint Inheritance

### Why Sprint Inheritance?

Sprint inheritance ensures consistency across task hierarchies. When tasks are organized into sprints, all subtasks must belong to the same sprint as their parent. This prevents:
- Split work across multiple sprints
- Inconsistent planning and tracking
- Confusion about sprint scope
- Broken task hierarchies

### Inheritance Rules

**Rule 1: Subtasks Inherit Parent Sprint**
- When creating subtask, `sprintId` is automatically set to parent's `sprintId`
- Explicitly provided `sprintId` in request body is **ignored**
- Subtask cannot override parent sprint

**Rule 2: Cannot Override Sprint**
- Subtasks cannot have different sprint than parent
- `PUT /api/tasks/:id` endpoint prevents sprint change if task has subtasks
- Use `PATCH /api/tasks/:id/sprint` to move entire hierarchy

**Rule 3: Cascade Moves**
- Moving parent to new sprint moves all descendants
- Operation is atomic (all succeed or all fail)
- Maintains hierarchy integrity

### Implementation Examples

**Creating Subtask - Sprint Ignored**:
```bash
# Parent task in Sprint A
POST /api/tasks/parent-uuid/subtasks
{
  "taskName": "Subtask",
  "sprintId": "sprint-B-uuid"  # This is IGNORED
}

# Result: Subtask created with sprintId = Sprint A (from parent)
```

**Preventing Sprint Mismatch**:
```bash
# Task has subtasks - sprint change blocked
PUT /api/tasks/parent-uuid
{
  "sprintId": "new-sprint-uuid"
}

# Response: 400 Bad Request
{
  "error": "Cannot change sprint of task with subtasks. Use move-to-sprint endpoint."
}
```

**Cascade Move - Correct Approach**:
```bash
# Move parent and all descendants atomically
PATCH /api/tasks/parent-uuid/sprint
{
  "sprintId": "new-sprint-uuid"
}

# Result: Parent + all descendants moved to new sprint
```

### Hierarchy Consistency

**Consistent Hierarchy**:
```
Sprint A
├── Task 1 (Sprint A)
│   ├── Subtask 1.1 (Sprint A)
│   └── Subtask 1.2 (Sprint A)
└── Task 2 (Sprint A)
```

**Inconsistent Hierarchy** (PREVENTED):
```
Sprint A
├── Task 1 (Sprint A)
│   ├── Subtask 1.1 (Sprint B) ❌ NOT ALLOWED
│   └── Subtask 1.2 (Sprint A)
└── Task 2 (Sprint A)
```

### Backlog Tasks

Tasks with `sprintId = null` are in the backlog:
- No sprint assigned
- Pending sprint planning
- Low priority or future work
- Sprint inheritance still applies (all subtasks also null)

---

## Permission Model

### Access Patterns

ServiceBay PM implements role-based and ownership-based permissions for granular access control.

### Permission Matrix

| Operation | Admin | Assignee | Creator | Other Member |
|-----------|-------|----------|---------|--------------|
| **List tasks** | All tasks | Assigned/created | Assigned/created | Assigned/created only |
| **View task** | Yes | Yes | Yes | No |
| **Create task** | Assign to anyone | Assign to self | Assign to self | Assign to self |
| **Create subtask** | Yes | On assigned/created | On assigned/created | No |
| **Update task** | Yes | Yes | Yes | No |
| **Update progress** | Yes | Yes (assigned only) | No | No |
| **Reassign task** | Yes | No | No | No |
| **Move to sprint** | Yes | No | No | No |
| **Delete task** | Yes | No | No | No |

### Permission Checks

**1. Task Visibility Filter**
```typescript
// Non-admins see only assigned or created tasks
if (!isAdmin) {
  where.OR = [
    { assignedToId: userId },
    { createdById: userId }
  ];
}
```

**2. Task Access Verification**
```typescript
function verifyTaskPermission(task, userId, isAdmin): boolean {
  if (isAdmin) return true;
  if (task.assignedToId === userId) return true;
  if (task.createdById === userId) return true;
  return false;
}
```

**3. Assignment Permission**
```typescript
// Members can only assign to themselves
if (assignedToId !== userId && !isAdmin) {
  throw new Error('Only admins can assign tasks to other users');
}
```

### Use Cases

**Admin User**:
- Can view, create, update, delete all tasks
- Can assign tasks to any user
- Can move tasks between sprints
- Can reorganize entire hierarchy

**Team Member (Task Assignee)**:
- Can view assigned tasks
- Can update task details (name, description, dates)
- Can update progress
- Cannot reassign to another user
- Cannot delete tasks
- Can create subtasks under assigned tasks

**Team Member (Task Creator)**:
- Can view created tasks
- Can update task details
- Cannot update progress (unless also assignee)
- Can create subtasks under created tasks

**Other Team Members**:
- Cannot see tasks not assigned or created by them
- Cannot interact with other users' tasks
- Can create own tasks

### Security Implications

1. **Data Isolation**: Members see only relevant tasks
2. **Accountability**: Creators and assignees tracked
3. **Controlled Assignment**: Prevents unauthorized task delegation
4. **Admin Oversight**: Admins can manage all tasks
5. **Audit Trail**: All operations logged with user context

---

## Security Features

### 1. Input Validation

All inputs are validated using Zod schemas before processing:

**Example Validation**:
```typescript
const createTaskSchema = z.object({
  taskName: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  sprintId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
}).refine(
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

**Benefits**:
- **Type Safety**: Ensures correct data types
- **SQL Injection Prevention**: Parameterized queries via Prisma
- **XSS Prevention**: Sanitization through trimming and validation
- **Business Rule Enforcement**: Date validation, depth limits
- **Clear Error Messages**: Structured validation errors for clients

### 2. Authorization Matrix

Comprehensive access control at route and service layers:

| Endpoint | Method | Middleware | Service Check |
|----------|--------|------------|---------------|
| GET /api/tasks | GET | isAuthenticated | Permission filter |
| POST /api/tasks | POST | isAuthenticated | Assignment check |
| GET /api/tasks/:id | GET | isAuthenticated | Owner/assignee check |
| PUT /api/tasks/:id | PUT | isAuthenticated | Owner/assignee check |
| PATCH /api/tasks/:id/progress | PATCH | isAuthenticated | Assignee/admin check |
| POST /api/tasks/:id/subtasks | POST | isAuthenticated | Parent permission check |
| PATCH /api/tasks/:id/sprint | PATCH | isAuthenticated + isAdmin | - |
| DELETE /api/tasks/:id | DELETE | isAuthenticated + isAdmin | - |
| GET /api/tasks/:id/hierarchy | GET | isAuthenticated | Owner/assignee check |
| GET /api/tasks/:id/stats | GET | isAuthenticated | Owner/assignee check |

**Route Protection Example**:
```typescript
router.delete('/:id', isAuthenticated, isAdmin, taskController.deleteTask);
router.patch('/:id/progress', isAuthenticated, taskController.updateProgress);
```

### 3. Audit Logging

All critical operations are logged for security and compliance:

**Logged Operations**:
```typescript
// Task creation
console.log(`Task created: "${task.taskName}" (${task.id}) by ${req.user?.email}`);

// Subtask creation
console.log(`Subtask created: "${task.taskName}" (${task.id}) under parent ${parentId} by ${req.user?.email}`);

// Task update
console.log(`Task updated: "${task.taskName}" (${task.id}) by ${req.user?.email}`);

// Progress update
console.log(`Task progress updated: ${task.id} to ${progress}% by ${req.user?.email}`);

// Sprint move
console.log(`Task moved to sprint: ${taskId} to ${sprintId || 'backlog'} (${result.subtasksUpdated} subtasks) by ${req.user?.email}`);

// Task deletion
console.log(`Task deleted: ${taskId} (cascade=${cascade}) by ${req.user?.email}`);
```

**Use Cases**:
- Security incident investigation
- Compliance audits (ISO 27001, SOC 2)
- User activity tracking
- Change history
- Debugging and troubleshooting
- Performance monitoring

### 4. Nesting Depth Enforcement

Maximum depth limit prevents abuse and maintains usability:

**Enforcement Points**:
1. **API Layer**: Check parent nestingLevel before creating subtask
2. **Validation**: `if (parent.nestingLevel >= 3) throw error`
3. **Database Index**: Fast queries by nestingLevel
4. **UI Layer**: Disable "Add Subtask" button at level 3

**Security Benefits**:
- Prevents malicious deep nesting (DoS potential)
- Maintains query performance
- Ensures UI usability
- Protects against infinite recursion bugs

### 5. Transactional Integrity

Critical operations use database transactions for atomicity:

**Sprint Move Transaction**:
```typescript
await prisma.$transaction(async (tx) => {
  // Update all descendants
  if (descendantIds.length > 0) {
    await tx.task.updateMany({
      where: { id: { in: descendantIds } },
      data: { sprintId }
    });
  }

  // Update the task itself
  const updatedTask = await tx.task.update({
    where: { id },
    data: { sprintId }
  });

  return { task: updatedTask, subtasksUpdated: descendantIds.length };
});
```

**Benefits**:
- All-or-nothing updates (ACID compliance)
- Prevents partial failures
- Data consistency guaranteed
- Rollback on errors

### 6. Cascade Delete Protection

Database-level cascade ensures referential integrity:

**Prisma Schema**:
```prisma
parentTask Task? @relation("TaskHierarchy", fields: [parentTaskId], references: [id], onDelete: Cascade)
```

**Security Benefits**:
- Prevents orphaned records
- Atomic deletion of entire subtree
- No manual cleanup needed
- Foreign key constraints enforced

### 7. Rate Limiting

API endpoints protected by rate limiting middleware:

**Configuration** (from security.ts):
- 100 requests per 15 minutes per IP
- Prevents brute force attacks
- Protects against DoS attempts
- Configurable limits per endpoint

---

## Frontend Integration Example

### TypeScript/React API Client

```typescript
/**
 * Task Management API Client
 * Handles all task-related API calls with type safety
 */
class TaskAPI {
  private baseUrl = '/api/tasks';

  /**
   * List tasks with filtering and pagination
   */
  async listTasks(params?: {
    page?: number;
    limit?: number;
    sprintId?: string;
    assignedToId?: string;
    createdById?: string;
    parentTaskId?: string;
    nestingLevel?: number;
    minProgress?: number;
    maxProgress?: number;
    includeSubtasks?: boolean;
    sortBy?: 'createdAt' | 'dueDate' | 'progress' | 'taskName';
    sortOrder?: 'asc' | 'desc';
  }) {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}?${query}`, {
      credentials: 'include',
    });
    return response.json();
  }

  /**
   * Get task by ID with optional relations
   */
  async getTask(id: string, options?: {
    includeSubtasks?: boolean;
    includeParent?: boolean;
  }) {
    const query = new URLSearchParams(options as any).toString();
    const response = await fetch(`${this.baseUrl}/${id}?${query}`, {
      credentials: 'include',
    });

    if (response.status === 404) {
      throw new Error('Task not found');
    }

    return response.json();
  }

  /**
   * Create top-level task
   */
  async createTask(data: {
    taskName: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
    sprintId?: string;
    assignedToId?: string;
  }) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to create task');
    }

    return result;
  }

  /**
   * Create subtask under parent
   */
  async createSubtask(parentId: string, data: {
    taskName: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
    assignedToId?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/${parentId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to create subtask');
    }

    return result;
  }

  /**
   * Update task
   */
  async updateTask(id: string, data: {
    taskName?: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
    sprintId?: string;
    assignedToId?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to update task');
    }

    return result;
  }

  /**
   * Update task progress (cascades to parent)
   */
  async updateProgress(id: string, progress: number) {
    const response = await fetch(`${this.baseUrl}/${id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ progress }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to update progress');
    }

    return result;
  }

  /**
   * Move task to different sprint (admin only)
   */
  async moveToSprint(id: string, sprintId: string | null) {
    const response = await fetch(`${this.baseUrl}/${id}/sprint`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sprintId }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to move task');
    }

    return result;
  }

  /**
   * Delete task (admin only)
   */
  async deleteTask(id: string, cascade = true) {
    const query = `?cascade=${cascade}`;
    const response = await fetch(`${this.baseUrl}/${id}${query}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.status === 400) {
      const result = await response.json();
      throw new Error(result.message);
    }

    return response.status === 204;
  }

  /**
   * Get task hierarchy
   */
  async getTaskHierarchy(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}/hierarchy`, {
      credentials: 'include',
    });
    return response.json();
  }

  /**
   * Get task statistics
   */
  async getTaskStats(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}/stats`, {
      credentials: 'include',
    });
    return response.json();
  }
}

export const taskAPI = new TaskAPI();
```

### Usage Examples in React Components

**1. Task List with Filters**:
```typescript
import { useEffect, useState } from 'react';
import { taskAPI } from './api/task';

function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    sprintId: null,
    minProgress: 0,
    sortBy: 'dueDate',
    sortOrder: 'asc',
  });

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      const result = await taskAPI.listTasks(filters);
      setTasks(result.data.tasks);
      setLoading(false);
    };
    fetchTasks();
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>Loading tasks...</div>;

  return (
    <div>
      <div className="filters">
        <select onChange={(e) => updateFilter('sortBy', e.target.value)}>
          <option value="dueDate">Due Date</option>
          <option value="progress">Progress</option>
          <option value="taskName">Name</option>
        </select>

        <input
          type="range"
          min="0"
          max="100"
          value={filters.minProgress}
          onChange={(e) => updateFilter('minProgress', e.target.value)}
        />
        <span>{filters.minProgress}% minimum</span>
      </div>

      <div className="task-list">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
```

**2. Create Task Form**:
```typescript
function CreateTaskForm({ sprintId, onSuccess }) {
  const [formData, setFormData] = useState({
    taskName: '',
    description: '',
    startDate: '',
    dueDate: '',
    sprintId: sprintId || '',
    assignedToId: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await taskAPI.createTask(formData);
      console.log('Task created:', result.data);
      onSuccess(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Task Name"
        value={formData.taskName}
        onChange={e => setFormData({...formData, taskName: e.target.value})}
        required
      />

      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={e => setFormData({...formData, description: e.target.value})}
      />

      <input
        type="datetime-local"
        value={formData.startDate}
        onChange={e => setFormData({...formData, startDate: e.target.value})}
      />

      <input
        type="datetime-local"
        value={formData.dueDate}
        onChange={e => setFormData({...formData, dueDate: e.target.value})}
      />

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Task'}
      </button>
    </form>
  );
}
```

**3. Progress Slider with Cascade**:
```typescript
function TaskProgressSlider({ task, onUpdate }) {
  const [progress, setProgress] = useState(task.progress);
  const [updating, setUpdating] = useState(false);

  const handleProgressChange = async (newProgress) => {
    setProgress(newProgress);
    setUpdating(true);

    try {
      await taskAPI.updateProgress(task.id, newProgress);
      onUpdate(); // Refresh parent to see cascaded changes
    } catch (err) {
      console.error('Failed to update progress:', err);
      setProgress(task.progress); // Revert on error
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="progress-slider">
      <label>{task.taskName}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={progress}
        onChange={(e) => handleProgressChange(parseInt(e.target.value))}
        disabled={updating}
      />
      <span>{progress}% {updating && '(updating...)'}</span>
    </div>
  );
}
```

**4. Hierarchical Task Tree**:
```typescript
function TaskTree({ taskId }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHierarchy = async () => {
      const result = await taskAPI.getTaskHierarchy(taskId);
      setHierarchy(result.data);
      setLoading(false);
    };
    fetchHierarchy();
  }, [taskId]);

  if (loading) return <div>Loading hierarchy...</div>;

  return (
    <div className="task-tree">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        {hierarchy.root && <span>{hierarchy.root.taskName} / </span>}
        {hierarchy.path.map(task => (
          <span key={task.id}>{task.taskName} / </span>
        ))}
        <strong>{hierarchy.current.taskName}</strong>
      </div>

      {/* Current Task */}
      <div className="current-task">
        <h2>{hierarchy.current.taskName}</h2>
        <ProgressBar progress={hierarchy.current.progress} />
      </div>

      {/* Descendants */}
      {hierarchy.descendants.length > 0 && (
        <div className="descendants">
          <h3>Subtasks</h3>
          {hierarchy.descendants.map(task => (
            <TaskTreeNode key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskTreeNode({ task }) {
  return (
    <div className="tree-node" style={{marginLeft: `${task.nestingLevel * 20}px`}}>
      <div>{task.taskName} ({task.progress}%)</div>
      {task.children?.map(child => (
        <TaskTreeNode key={child.id} task={child} />
      ))}
    </div>
  );
}
```

**5. Task Statistics Dashboard**:
```typescript
function TaskStatsDashboard({ taskId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const result = await taskAPI.getTaskStats(taskId);
      setStats(result.data);
      setLoading(false);
    };
    fetchStats();
  }, [taskId]);

  if (loading) return <div>Loading statistics...</div>;

  return (
    <div className="stats-dashboard">
      <div className="stat-card">
        <h4>Total Subtasks</h4>
        <div className="stat-value">{stats.totalSubtasks}</div>
      </div>

      <div className="stat-card">
        <h4>Completed</h4>
        <div className="stat-value">
          {stats.completedSubtasks} / {stats.totalSubtasks}
        </div>
      </div>

      <div className="stat-card">
        <h4>Overall Progress</h4>
        <div className="stat-value">{stats.overallProgress}%</div>
        <ProgressBar progress={stats.overallProgress} />
      </div>

      <div className="stat-card">
        <h4>Status</h4>
        <div className={`stat-value ${stats.isOnTrack ? 'on-track' : 'behind'}`}>
          {stats.isOnTrack ? 'On Track' : 'Behind Schedule'}
        </div>
      </div>

      {stats.daysRemaining !== null && (
        <div className="stat-card">
          <h4>Days Remaining</h4>
          <div className="stat-value">{stats.daysRemaining}</div>
        </div>
      )}

      {stats.estimatedCompletion && (
        <div className="stat-card">
          <h4>Estimated Completion</h4>
          <div className="stat-value">
            {new Date(stats.estimatedCompletion).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Use Cases

### Common Workflows

**1. Create Task Hierarchy for New Feature**:
```bash
# Step 1: Create top-level task
TASK_ID=$(curl -X POST "http://localhost:3000/api/tasks" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Implement User Profile",
    "sprintId": "sprint-uuid",
    "assignedToId": "user-uuid"
  }' | jq -r '.data.id')

# Step 2: Create subtasks
SUBTASK1=$(curl -X POST "http://localhost:3000/api/tasks/$TASK_ID/subtasks" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Create Profile Schema",
    "assignedToId": "backend-dev-uuid"
  }' | jq -r '.data.id')

SUBTASK2=$(curl -X POST "http://localhost:3000/api/tasks/$TASK_ID/subtasks" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Design Profile UI",
    "assignedToId": "frontend-dev-uuid"
  }' | jq -r '.data.id')

# Step 3: Create sub-subtasks
curl -X POST "http://localhost:3000/api/tasks/$SUBTASK1/subtasks" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Add Avatar Field",
    "assignedToId": "backend-dev-uuid"
  }'
```

**2. Track Progress Across Team**:
```bash
# Team member updates their task
curl -X PATCH "http://localhost:3000/api/tasks/task-uuid/progress" \
  -H "Cookie: connect.sid=member-session" \
  -H "Content-Type: application/json" \
  -d '{"progress": 80}'

# Progress automatically cascades to parent
# Manager views parent task to see aggregated progress
curl -X GET "http://localhost:3000/api/tasks/parent-uuid" \
  -H "Cookie: connect.sid=manager-session"

# Get statistics for sprint planning
curl -X GET "http://localhost:3000/api/tasks/parent-uuid/stats" \
  -H "Cookie: connect.sid=manager-session"
```

**3. Reorganize Tasks Between Sprints**:
```bash
# Get all incomplete tasks from old sprint
OLD_TASKS=$(curl -X GET "http://localhost:3000/api/tasks?sprintId=old-sprint&maxProgress=99&nestingLevel=0" \
  -H "Cookie: connect.sid=admin-session" | jq -r '.data.tasks[].id')

# Move each task (with subtasks) to new sprint
for TASK_ID in $OLD_TASKS; do
  curl -X PATCH "http://localhost:3000/api/tasks/$TASK_ID/sprint" \
    -H "Cookie: connect.sid=admin-session" \
    -H "Content-Type: application/json" \
    -d '{"sprintId": "new-sprint-uuid"}'
done

# Move completed tasks to backlog for archiving
COMPLETED=$(curl -X GET "http://localhost:3000/api/tasks?sprintId=old-sprint&minProgress=100&nestingLevel=0" \
  -H "Cookie: connect.sid=admin-session" | jq -r '.data.tasks[].id')

for TASK_ID in $COMPLETED; do
  curl -X PATCH "http://localhost:3000/api/tasks/$TASK_ID/sprint" \
    -H "Cookie: connect.sid=admin-session" \
    -H "Content-Type: application/json" \
    -d '{"sprintId": null}'
done
```

**4. Monitor Project Health**:
```bash
# Get all top-level tasks in sprint
curl -X GET "http://localhost:3000/api/tasks?sprintId=sprint-uuid&nestingLevel=0&includeSubtasks=true" \
  -H "Cookie: connect.sid=session"

# Get detailed stats for each major task
for TASK_ID in $(echo $TASKS | jq -r '.data.tasks[].id'); do
  echo "Stats for task $TASK_ID:"
  curl -X GET "http://localhost:3000/api/tasks/$TASK_ID/stats" \
    -H "Cookie: connect.sid=session" | jq '.data'
done

# Identify at-risk tasks (behind schedule)
curl -X GET "http://localhost:3000/api/tasks?sprintId=sprint-uuid" \
  -H "Cookie: connect.sid=session" | \
  jq '.data.tasks[] | select(.progress < 50) | {id, taskName, progress}'
```

**5. Daily Standup Report**:
```bash
# Get tasks assigned to user with progress
curl -X GET "http://localhost:3000/api/tasks?assignedToId=user-uuid&sortBy=dueDate&sortOrder=asc" \
  -H "Cookie: connect.sid=session" | \
  jq '.data.tasks[] | {
    taskName,
    progress,
    dueDate,
    subtasks: ._count.subtasks
  }'

# Get hierarchy for complex task
curl -X GET "http://localhost:3000/api/tasks/task-uuid/hierarchy" \
  -H "Cookie: connect.sid=session"
```

---

## Testing

### Unit Tests (Service Layer)

```typescript
import { taskService } from '@/tasks/service';
import prisma from '@/database/client';

describe('TaskService', () => {
  describe('createTask', () => {
    it('should create top-level task with nestingLevel 0', async () => {
      const task = await taskService.createTask(
        {
          taskName: 'Test Task',
          description: 'Test description',
        },
        'user-uuid',
        false
      );

      expect(task.nestingLevel).toBe(0);
      expect(task.parentTaskId).toBeNull();
      expect(task.progress).toBe(0);
      expect(task.createdById).toBe('user-uuid');
    });

    it('should prevent member from assigning to another user', async () => {
      await expect(
        taskService.createTask(
          {
            taskName: 'Test Task',
            assignedToId: 'other-user-uuid',
          },
          'user-uuid',
          false // Not admin
        )
      ).rejects.toThrow('Only admins can assign tasks to other users');
    });
  });

  describe('createSubtask', () => {
    it('should increment nesting level', async () => {
      const parent = await taskService.createTask(
        { taskName: 'Parent' },
        'user-uuid',
        true
      );

      const subtask = await taskService.createSubtask(
        parent.id,
        { taskName: 'Subtask' },
        'user-uuid',
        true
      );

      expect(subtask.nestingLevel).toBe(1);
      expect(subtask.parentTaskId).toBe(parent.id);
    });

    it('should inherit sprint from parent', async () => {
      const parent = await taskService.createTask(
        {
          taskName: 'Parent',
          sprintId: 'sprint-uuid',
        },
        'user-uuid',
        true
      );

      const subtask = await taskService.createSubtask(
        parent.id,
        {
          taskName: 'Subtask',
          // sprintId intentionally omitted
        },
        'user-uuid',
        true
      );

      expect(subtask.sprintId).toBe('sprint-uuid');
    });

    it('should prevent nesting beyond level 3', async () => {
      // Create 4-level deep hierarchy
      const level0 = await taskService.createTask(
        { taskName: 'Level 0' },
        'user-uuid',
        true
      );
      const level1 = await taskService.createSubtask(
        level0.id,
        { taskName: 'Level 1' },
        'user-uuid',
        true
      );
      const level2 = await taskService.createSubtask(
        level1.id,
        { taskName: 'Level 2' },
        'user-uuid',
        true
      );
      const level3 = await taskService.createSubtask(
        level2.id,
        { taskName: 'Level 3' },
        'user-uuid',
        true
      );

      // Attempt level 4 should fail
      await expect(
        taskService.createSubtask(
          level3.id,
          { taskName: 'Level 4' },
          'user-uuid',
          true
        )
      ).rejects.toThrow('Maximum nesting depth');
    });
  });

  describe('updateProgress', () => {
    it('should cascade progress to parent', async () => {
      const parent = await taskService.createTask(
        { taskName: 'Parent' },
        'user-uuid',
        true
      );

      const child1 = await taskService.createSubtask(
        parent.id,
        { taskName: 'Child 1' },
        'user-uuid',
        true
      );

      const child2 = await taskService.createSubtask(
        parent.id,
        { taskName: 'Child 2' },
        'user-uuid',
        true
      );

      // Update children
      await taskService.updateProgress(child1.id, 80, 'user-uuid', true);
      await taskService.updateProgress(child2.id, 60, 'user-uuid', true);

      // Check parent recalculated
      const updatedParent = await prisma.task.findUnique({
        where: { id: parent.id },
      });

      expect(updatedParent.progress).toBe(70); // (80 + 60) / 2
    });

    it('should cascade through multiple levels', async () => {
      // Create 3-level hierarchy
      const level0 = await taskService.createTask(
        { taskName: 'Level 0' },
        'user-uuid',
        true
      );
      const level1a = await taskService.createSubtask(
        level0.id,
        { taskName: 'Level 1a' },
        'user-uuid',
        true
      );
      const level1b = await taskService.createSubtask(
        level0.id,
        { taskName: 'Level 1b' },
        'user-uuid',
        true
      );
      const level2 = await taskService.createSubtask(
        level1a.id,
        { taskName: 'Level 2' },
        'user-uuid',
        true
      );

      // Update leaf node
      await taskService.updateProgress(level2.id, 100, 'user-uuid', true);

      // Check cascading
      const updated1a = await prisma.task.findUnique({
        where: { id: level1a.id },
      });
      const updated0 = await prisma.task.findUnique({
        where: { id: level0.id },
      });

      expect(updated1a.progress).toBe(100); // Only child at 100
      expect(updated0.progress).toBe(50); // (100 + 0) / 2
    });
  });

  describe('moveToSprint', () => {
    it('should move task and all descendants', async () => {
      const parent = await taskService.createTask(
        {
          taskName: 'Parent',
          sprintId: 'old-sprint',
        },
        'user-uuid',
        true
      );

      const child = await taskService.createSubtask(
        parent.id,
        { taskName: 'Child' },
        'user-uuid',
        true
      );

      const result = await taskService.moveToSprint(
        parent.id,
        'new-sprint',
        'user-uuid',
        true
      );

      expect(result.subtasksUpdated).toBe(1);

      const updatedChild = await prisma.task.findUnique({
        where: { id: child.id },
      });

      expect(updatedChild.sprintId).toBe('new-sprint');
    });
  });

  describe('deleteTask', () => {
    it('should cascade delete all descendants', async () => {
      const parent = await taskService.createTask(
        { taskName: 'Parent' },
        'user-uuid',
        true
      );

      const child = await taskService.createSubtask(
        parent.id,
        { taskName: 'Child' },
        'user-uuid',
        true
      );

      await taskService.deleteTask(parent.id, true);

      // Verify both deleted
      const deletedParent = await prisma.task.findUnique({
        where: { id: parent.id },
      });
      const deletedChild = await prisma.task.findUnique({
        where: { id: child.id },
      });

      expect(deletedParent).toBeNull();
      expect(deletedChild).toBeNull();
    });

    it('should prevent delete without cascade if has subtasks', async () => {
      const parent = await taskService.createTask(
        { taskName: 'Parent' },
        'user-uuid',
        true
      );

      await taskService.createSubtask(
        parent.id,
        { taskName: 'Child' },
        'user-uuid',
        true
      );

      await expect(
        taskService.deleteTask(parent.id, false)
      ).rejects.toThrow('Task has 1 subtasks');
    });
  });

  describe('getTaskHierarchy', () => {
    it('should return complete hierarchy context', async () => {
      const level0 = await taskService.createTask(
        { taskName: 'Root' },
        'user-uuid',
        true
      );
      const level1 = await taskService.createSubtask(
        level0.id,
        { taskName: 'Level 1' },
        'user-uuid',
        true
      );
      const level2 = await taskService.createSubtask(
        level1.id,
        { taskName: 'Level 2' },
        'user-uuid',
        true
      );

      const hierarchy = await taskService.getTaskHierarchy(
        level1.id,
        'user-uuid',
        true
      );

      expect(hierarchy.root.id).toBe(level0.id);
      expect(hierarchy.current.id).toBe(level1.id);
      expect(hierarchy.descendants).toHaveLength(1);
      expect(hierarchy.descendants[0].id).toBe(level2.id);
    });
  });

  describe('getTaskStats', () => {
    it('should calculate statistics correctly', async () => {
      const parent = await taskService.createTask(
        { taskName: 'Parent' },
        'user-uuid',
        true
      );

      await taskService.createSubtask(
        parent.id,
        { taskName: 'Child 1' },
        'user-uuid',
        true
      );
      const child2 = await taskService.createSubtask(
        parent.id,
        { taskName: 'Child 2' },
        'user-uuid',
        true
      );
      await taskService.createSubtask(
        parent.id,
        { taskName: 'Child 3' },
        'user-uuid',
        true
      );

      // Update progress
      await taskService.updateProgress(child2.id, 100, 'user-uuid', true);

      const stats = await taskService.getTaskStats(
        parent.id,
        'user-uuid',
        true
      );

      expect(stats.totalSubtasks).toBe(3);
      expect(stats.completedSubtasks).toBe(1);
      expect(stats.inProgressSubtasks).toBe(0);
      expect(stats.overallProgress).toBeCloseTo(33.3, 1);
    });
  });
});
```

### Integration Tests

```typescript
import request from 'supertest';
import app from '@/app';

describe('Task Management API', () => {
  let adminSession: string;
  let memberSession: string;
  let taskId: string;

  beforeAll(async () => {
    // Setup test sessions
    adminSession = await getTestSession('admin@servicebay.ai');
    memberSession = await getTestSession('member@servicebay.ai');
  });

  describe('POST /api/tasks', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ taskName: 'Test Task' });

      expect(response.status).toBe(401);
    });

    it('should create task with valid data', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Cookie', memberSession)
        .send({
          taskName: 'Test Task',
          description: 'Test description',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.taskName).toBe('Test Task');
      expect(response.body.data.nestingLevel).toBe(0);

      taskId = response.body.data.id;
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Cookie', memberSession)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/tasks/:id/subtasks', () => {
    it('should create subtask with incremented nesting level', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .set('Cookie', memberSession)
        .send({ taskName: 'Subtask' });

      expect(response.status).toBe(201);
      expect(response.body.data.nestingLevel).toBe(1);
      expect(response.body.data.parentTaskId).toBe(taskId);
    });

    it('should require permission on parent', async () => {
      const otherMemberSession = await getTestSession('other@servicebay.ai');

      const response = await request(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .set('Cookie', otherMemberSession)
        .send({ taskName: 'Subtask' });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/tasks/:id/progress', () => {
    it('should update progress', async () => {
      const response = await request(app)
        .patch(`/api/tasks/${taskId}/progress`)
        .set('Cookie', memberSession)
        .send({ progress: 75 });

      expect(response.status).toBe(200);
      expect(response.body.data.progress).toBe(75);
    });

    it('should validate progress range', async () => {
      const response = await request(app)
        .patch(`/api/tasks/${taskId}/progress`)
        .set('Cookie', memberSession)
        .send({ progress: 150 });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id/sprint', () => {
    it('should require admin', async () => {
      const response = await request(app)
        .patch(`/api/tasks/${taskId}/sprint`)
        .set('Cookie', memberSession)
        .send({ sprintId: 'new-sprint' });

      expect(response.status).toBe(403);
    });

    it('should move task and subtasks', async () => {
      const response = await request(app)
        .patch(`/api/tasks/${taskId}/sprint`)
        .set('Cookie', adminSession)
        .send({ sprintId: null });

      expect(response.status).toBe(200);
      expect(response.body.data.task.sprintId).toBeNull();
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should require admin', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Cookie', memberSession);

      expect(response.status).toBe(403);
    });

    it('should delete task with cascade', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}?cascade=true`)
        .set('Cookie', adminSession);

      expect(response.status).toBe(204);
    });
  });
});
```

---

## Troubleshooting

### Issue: "Maximum nesting depth (4 levels) reached"

**Cause**: Attempting to create subtask under a level 3 task (max depth).

**Solution**:
1. Verify parent task nesting level: `GET /api/tasks/:id`
2. If parent is level 3, cannot add subtask
3. Consider flattening hierarchy or splitting into separate top-level tasks
4. Level 3 tasks are designed for granular details only

**Prevention**:
- Plan hierarchy structure before creation
- Use levels appropriately: 0=Epic, 1=Story, 2=Task, 3=Subtask
- UI should disable "Add Subtask" button at level 3

### Issue: "No permission to create subtask under this task"

**Cause**: User is not the assignee, creator, or admin of parent task.

**Solution**:
1. Verify you have permission on parent task
2. Check if you're assignee: `GET /api/tasks/:parentId`
3. Ask admin or assignee to create subtask
4. Admin can create subtasks under any task

**Permission Check**:
```bash
# Check your access
curl -X GET "http://localhost:3000/api/tasks/parent-uuid" \
  -H "Cookie: connect.sid=session"

# If 403: No access, cannot create subtask
# If 200: Have access, should be able to create subtask
```

### Issue: Progress not cascading to parent

**Cause**: Usually a bug or misunderstanding of cascading behavior.

**Troubleshooting Steps**:
1. Verify progress update succeeded: Check response
2. Fetch parent task to see updated progress
3. Check server logs for cascade errors
4. Verify parent-child relationship exists

**Debug Query**:
```bash
# Update child progress
curl -X PATCH "http://localhost:3000/api/tasks/child-uuid/progress" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{"progress": 80}'

# Immediately fetch parent
curl -X GET "http://localhost:3000/api/tasks/parent-uuid" \
  -H "Cookie: connect.sid=session"

# Check parent progress has changed
```

### Issue: "Cannot change sprint of task with subtasks"

**Cause**: Attempting to use `PUT /api/tasks/:id` to change sprint when task has subtasks.

**Solution**:
1. Use `PATCH /api/tasks/:id/sprint` endpoint instead
2. This endpoint moves task and all descendants atomically
3. Prevents sprint inheritance inconsistency

**Correct Workflow**:
```bash
# Wrong approach (fails if has subtasks)
curl -X PUT "http://localhost:3000/api/tasks/task-uuid" \
  -H "Cookie: connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{"sprintId": "new-sprint"}'

# Correct approach (moves entire subtree)
curl -X PATCH "http://localhost:3000/api/tasks/task-uuid/sprint" \
  -H "Cookie: connect.sid=admin-session" \
  -H "Content-Type: application/json" \
  -d '{"sprintId": "new-sprint"}'
```

### Issue: "Task has X subtasks. Use cascade=true to delete"

**Cause**: Attempting to delete task with `cascade=false` when subtasks exist.

**Solution**:
1. Option 1: Delete with `cascade=true` (default) to remove entire subtree
2. Option 2: Delete subtasks individually first
3. Option 3: Move subtasks to different parent before deleting

**Safe Delete**:
```bash
# Check subtask count first
TASK=$(curl -X GET "http://localhost:3000/api/tasks/task-uuid" \
  -H "Cookie: connect.sid=session")

SUBTASK_COUNT=$(echo $TASK | jq -r '.data._count.subtasks')

if [ "$SUBTASK_COUNT" -gt 0 ]; then
  echo "Warning: Deleting task will also delete $SUBTASK_COUNT subtasks"
fi

# Delete with cascade
curl -X DELETE "http://localhost:3000/api/tasks/task-uuid?cascade=true" \
  -H "Cookie: connect.sid=admin-session"
```

### Issue: Subtask has different sprint than parent

**Cause**: Should not be possible due to sprint inheritance, but could occur from direct database manipulation.

**Diagnosis**:
```sql
-- Find inconsistent tasks
SELECT t.id, t.taskName, t.sprintId, p.sprintId as parentSprintId
FROM tasks t
JOIN tasks p ON t.parentTaskId = p.id
WHERE t.sprintId != p.sprintId OR (t.sprintId IS NULL AND p.sprintId IS NOT NULL);
```

**Fix**:
```bash
# Move parent (cascades to all descendants)
curl -X PATCH "http://localhost:3000/api/tasks/parent-uuid/sprint" \
  -H "Cookie: connect.sid=admin-session" \
  -H "Content-Type: application/json" \
  -d '{"sprintId": "correct-sprint-uuid"}'
```

### Issue: Orphaned tasks (parentTaskId points to deleted task)

**Cause**: Should not be possible due to `onDelete: Cascade`, but could occur from database issues.

**Diagnosis**:
```sql
-- Find orphaned tasks
SELECT t.id, t.taskName, t.parentTaskId
FROM tasks t
WHERE t.parentTaskId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tasks p WHERE p.id = t.parentTaskId);
```

**Fix** (requires database access):
```sql
-- Option 1: Set parentTaskId to null (make top-level)
UPDATE tasks
SET parentTaskId = NULL, nestingLevel = 0
WHERE parentTaskId NOT IN (SELECT id FROM tasks);

-- Option 2: Delete orphaned tasks
DELETE FROM tasks
WHERE parentTaskId NOT IN (SELECT id FROM tasks);
```

### Issue: Task statistics show incorrect completion estimates

**Cause**: Estimation algorithm requires both startDate and dueDate, and assumes linear progress.

**Understanding Estimates**:
- `estimatedCompletion`: Calculated only if startDate and dueDate exist
- Algorithm: `velocity = progress / elapsedDays`, then `estimatedDays = remainingProgress / velocity`
- Assumes consistent velocity (may not reflect reality)
- `isOnTrack`: Compares actual progress vs expected progress at current point

**Improving Accuracy**:
1. Always set startDate and dueDate on tasks
2. Update progress regularly and accurately
3. Break down tasks into smaller units for better tracking
4. Use statistics as rough guide, not absolute truth

---

## Best Practices

### 1. Task Organization

**Hierarchical Structure**:
```
Level 0: Epics / Major Features
  - Large, high-level objectives
  - Example: "User Authentication System"

Level 1: User Stories / Components
  - Functional components
  - Example: "OAuth 2.0 Integration"

Level 2: Implementation Tasks
  - Specific development work
  - Example: "Configure Google OAuth Provider"

Level 3: Granular Details
  - Small, specific actions
  - Example: "Add redirect URI to console"
```

**Good Practice**:
```typescript
// Create epic
const epic = await taskAPI.createTask({
  taskName: "User Authentication",
  sprintId: "sprint-1",
});

// Create stories
const oauth = await taskAPI.createSubtask(epic.id, {
  taskName: "OAuth Integration",
});

// Create tasks
const google = await taskAPI.createSubtask(oauth.id, {
  taskName: "Google Provider",
  assignedToId: "backend-dev",
});

// Create details
await taskAPI.createSubtask(google.id, {
  taskName: "Add redirect URI",
  assignedToId: "backend-dev",
});
```

### 2. Progress Tracking

**Regular Updates**:
```typescript
// Bad: Update only at start and end
await taskAPI.updateProgress(taskId, 0);  // Day 1
// ... weeks pass ...
await taskAPI.updateProgress(taskId, 100); // Day 30

// Good: Update regularly
await taskAPI.updateProgress(taskId, 0);   // Day 1
await taskAPI.updateProgress(taskId, 25);  // Day 7
await taskAPI.updateProgress(taskId, 50);  // Day 14
await taskAPI.updateProgress(taskId, 75);  // Day 21
await taskAPI.updateProgress(taskId, 100); // Day 28
```

**Meaningful Progress**:
- 0%: Not started
- 1-24%: Initial setup/research
- 25-49%: Implementation in progress
- 50-74%: Core functionality complete
- 75-99%: Testing and refinement
- 100%: Complete and verified

### 3. Permission Management

**Clear Ownership**:
```typescript
// Good: Assign tasks clearly
await taskAPI.createTask({
  taskName: "Backend API",
  assignedToId: "backend-dev-uuid",
  createdById: currentUser.id,
});

// Good: Admin coordinates assignments
if (isAdmin) {
  await taskAPI.updateTask(taskId, {
    assignedToId: "different-dev-uuid",
  });
}

// Bad: Unassigned tasks
await taskAPI.createTask({
  taskName: "Some Task",
  // No assignedToId - unclear who should work on this
});
```

**Team Collaboration**:
```typescript
// Member creates task for themselves
const myTask = await taskAPI.createTask({
  taskName: "Implement Feature X",
  assignedToId: currentUser.id,
});

// Member updates own progress
await taskAPI.updateProgress(myTask.id, 50);

// Admin reassigns if needed
if (isAdmin) {
  await taskAPI.updateTask(myTask.id, {
    assignedToId: "other-dev-uuid",
  });
}
```

### 4. Sprint Planning

**Organize by Sprint**:
```typescript
// Create sprint first
const sprint = await sprintAPI.createSprint({
  sprintName: "Sprint 5",
  startDate: "2025-02-01",
  endDate: "2025-02-14",
});

// Create tasks in sprint
await taskAPI.createTask({
  taskName: "Feature A",
  sprintId: sprint.id,
});

await taskAPI.createTask({
  taskName: "Feature B",
  sprintId: sprint.id,
});

// Keep backlog separate
await taskAPI.createTask({
  taskName: "Future Feature",
  sprintId: null, // Backlog
});
```

**Sprint Reorganization**:
```typescript
// At sprint end, move incomplete tasks
const incompleteTasks = await taskAPI.listTasks({
  sprintId: currentSprint.id,
  maxProgress: 99,
  nestingLevel: 0,
});

for (const task of incompleteTasks.data.tasks) {
  await taskAPI.moveToSprint(task.id, nextSprint.id);
}

// Move completed tasks to backlog for archiving
const completedTasks = await taskAPI.listTasks({
  sprintId: currentSprint.id,
  minProgress: 100,
  nestingLevel: 0,
});

for (const task of completedTasks.data.tasks) {
  await taskAPI.moveToSprint(task.id, null);
}
```

### 5. Error Handling

**Graceful Degradation**:
```typescript
async function updateTaskProgress(taskId: string, progress: number) {
  try {
    await taskAPI.updateProgress(taskId, progress);
    showNotification('Progress updated successfully');
  } catch (error) {
    if (error.message.includes('permission')) {
      showError('You do not have permission to update this task');
    } else if (error.message.includes('not found')) {
      showError('Task no longer exists');
    } else {
      showError('Failed to update progress. Please try again.');
      // Log error for debugging
      console.error('Progress update failed:', error);
    }
  }
}
```

**Optimistic Updates**:
```typescript
function TaskProgressSlider({ task }) {
  const [progress, setProgress] = useState(task.progress);
  const [syncing, setSyncing] = useState(false);

  const handleUpdate = async (newProgress) => {
    // Optimistic update
    setProgress(newProgress);
    setSyncing(true);

    try {
      await taskAPI.updateProgress(task.id, newProgress);
    } catch (error) {
      // Revert on error
      setProgress(task.progress);
      showError('Update failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <input
      type="range"
      value={progress}
      onChange={(e) => handleUpdate(parseInt(e.target.value))}
      disabled={syncing}
    />
  );
}
```

---

## Performance Considerations

### 1. Recursive Queries

**Challenge**: Hierarchical data requires recursive traversal.

**Optimization Strategies**:

**A. Limit Depth**:
```typescript
// 4-level limit prevents infinite recursion
if (parent.nestingLevel >= 3) {
  throw new Error('Maximum depth reached');
}
```

**B. Pagination**:
```typescript
// Paginate list queries
const tasks = await taskAPI.listTasks({
  page: 1,
  limit: 20, // Don't load all tasks at once
});
```

**C. Selective Loading**:
```typescript
// Don't include subtasks by default
await taskAPI.getTask(taskId); // Fast

// Only include when needed
await taskAPI.getTask(taskId, { includeSubtasks: true }); // Slower
```

### 2. Database Indexes

**Existing Indexes** (from schema):
```prisma
@@index([parentTaskId])
@@index([sprintId])
@@index([assignedToId])
@@index([createdById])
@@index([nestingLevel])
@@index([progress])
```

**Query Performance**:
- Filter by sprint: Uses `sprintId` index
- Filter by assignee: Uses `assignedToId` index
- Filter by level: Uses `nestingLevel` index
- Filter by progress: Uses `progress` index
- Parent lookups: Uses `parentTaskId` index

### 3. Caching Strategies

**Client-Side Caching**:
```typescript
class TaskCache {
  private cache = new Map();
  private TTL = 5 * 60 * 1000; // 5 minutes

  async getTask(id: string) {
    const cached = this.cache.get(id);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const data = await taskAPI.getTask(id);
    this.cache.set(id, { data, timestamp: Date.now() });
    return data;
  }

  invalidate(id: string) {
    this.cache.delete(id);
  }

  invalidateAll() {
    this.cache.clear();
  }
}
```

**Server-Side Caching** (Redis example):
```typescript
async function getCachedTask(id: string) {
  const cacheKey = `task:${id}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Query database
  const task = await taskService.getTaskById(id, false, false);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(task));

  return task;
}

// Invalidate on updates
await taskService.updateTask(id, data);
await redis.del(`task:${id}`);
```

### 4. Batch Operations

**Efficient Bulk Updates**:
```typescript
// Bad: Sequential updates
for (const taskId of taskIds) {
  await taskAPI.updateProgress(taskId, 100);
}

// Good: Parallel requests
await Promise.all(
  taskIds.map(taskId => taskAPI.updateProgress(taskId, 100))
);
```

**Database-Level Batching**:
```typescript
// Move multiple tasks at once
await prisma.task.updateMany({
  where: {
    id: { in: taskIds },
  },
  data: {
    sprintId: newSprintId,
  },
});
```

### 5. Query Optimization

**Parallel Queries**:
```typescript
// Good: Execute independent queries in parallel
const [tasks, total] = await Promise.all([
  prisma.task.findMany({ where, skip, take }),
  prisma.task.count({ where }),
]);
```

**Selective Field Loading**:
```typescript
// Good: Only load needed fields
await prisma.task.findUnique({
  where: { id },
  select: {
    id: true,
    taskName: true,
    progress: true,
    // Don't load large description field if not needed
  },
});
```

**Avoid N+1 Queries**:
```typescript
// Bad: N+1 query problem
const tasks = await prisma.task.findMany();
for (const task of tasks) {
  const assignee = await prisma.user.findUnique({
    where: { id: task.assignedToId },
  });
}

// Good: Use include to join
const tasks = await prisma.task.findMany({
  include: {
    assignedTo: true,
  },
});
```

---

## Related Documentation

- [Authentication & Authorization](./02-authentication.md) - Session management and RBAC
- [Database Schema](./01-database-schema.md) - Complete database structure and relationships
- [User Management](./03-user-management.md) - User API for assignments and permissions
- [Sprint Management](./04-sprint-management.md) - Sprint API for task organization
- [Task Management Plan](../plans/05-task-management-plan.md) - Implementation planning and research

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained by**: ServiceBay.ai Development Team
