# Sprint Management API Documentation

## Overview

The Sprint Management API provides comprehensive endpoints for managing sprints in ServiceBay PM. It implements robust date range validation with overlap detection, role-based access control (RBAC), audit logging, and follows REST best practices. Sprints are time-boxed iterations that organize tasks and help teams plan their work effectively.

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
2. **Service** (`service.ts`): Business logic, overlap detection, and database operations
3. **Controller** (`controller.ts`): Request/response handling and error management
4. **Routes** (`routes.ts`): RESTful endpoint definitions with authorization

## API Endpoints

### Base URL
```
/api/sprints
```

### Authentication
All endpoints require authentication. Include session cookie in requests.

---

### 1. List Sprints

**GET** `/api/sprints`

List all sprints with filtering, sorting, and pagination.

**Authorization**: All authenticated users

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 20 | Items per page (min: 1, max: 100) |
| isActive | boolean | No | - | Filter by active status |
| includeStats | boolean | No | false | Include task counts |
| sortBy | string | No | startDate | Sort field (startDate, endDate, createdAt) |
| sortOrder | string | No | desc | Sort order (asc, desc) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "uuid",
        "sprintName": "Sprint 1",
        "startDate": "2025-03-01T00:00:00Z",
        "endDate": "2025-03-14T23:59:59Z",
        "goal": "Complete user authentication",
        "isActive": true,
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

**With Stats** (`includeStats=true`):
```json
{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "uuid",
        "sprintName": "Sprint 1",
        "startDate": "2025-03-01T00:00:00Z",
        "endDate": "2025-03-14T23:59:59Z",
        "goal": "Complete user authentication",
        "isActive": true,
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z",
        "_count": {
          "tasks": 15
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `400 Bad Request`: Invalid query parameters

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/sprints?page=1&limit=10&isActive=true&sortBy=startDate&sortOrder=desc" \
  -H "Cookie: connect.sid=session-id"
```

---

### 2. Get Active Sprint

**GET** `/api/sprints/active`

Get the currently active sprint based on current date and time.

**Authorization**: All authenticated users

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-14T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "_count": {
      "tasks": 15
    }
  }
}
```

**Active Sprint Logic**:
A sprint is considered active when:
- `isActive` is `true`
- Current date/time is between `startDate` and `endDate` (inclusive)
- Query: `startDate <= NOW <= endDate AND isActive = true`

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `404 Not Found`: No active sprint exists

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/sprints/active" \
  -H "Cookie: connect.sid=session-id"
```

---

### 3. Get Sprint by ID

**GET** `/api/sprints/:id`

Get detailed information about a specific sprint.

**Authorization**: All authenticated users

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Sprint ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| includeTasks | boolean | No | false | Include tasks in sprint |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-14T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "_count": {
      "tasks": 15
    }
  }
}
```

**With Tasks** (`includeTasks=true`):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-14T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "_count": {
      "tasks": 15
    },
    "tasks": [
      {
        "id": "task-uuid",
        "taskName": "Implement login form",
        "progress": 75,
        "assignedTo": {
          "id": "user-uuid",
          "name": "John Doe",
          "email": "john@servicebay.ai"
        }
      }
    ]
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `400 Bad Request`: Invalid UUID format
- `404 Not Found`: Sprint does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/sprints/123e4567-e89b-12d3-a456-426614174000?includeTasks=true" \
  -H "Cookie: connect.sid=session-id"
```

---

### 4. Get Sprint Tasks

**GET** `/api/sprints/:id/tasks`

Get all tasks associated with a specific sprint with pagination.

**Authorization**: All authenticated users

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Sprint ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 20 | Items per page (min: 1, max: 100) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "sprint": {
      "id": "uuid",
      "sprintName": "Sprint 1"
    },
    "tasks": [
      {
        "id": "uuid",
        "taskName": "Implement login form",
        "sprintId": "sprint-uuid",
        "parentTaskId": null,
        "details": "Create a responsive login form with validation",
        "progress": 75,
        "assignedToId": "user-uuid",
        "startDate": "2025-03-01T00:00:00Z",
        "deadline": "2025-03-10T23:59:59Z",
        "nestingLevel": 0,
        "createdById": "admin-uuid",
        "createdAt": "2025-03-01T10:00:00Z",
        "updatedAt": "2025-03-08T14:30:00Z",
        "assignedTo": {
          "id": "user-uuid",
          "name": "John Doe",
          "email": "john@servicebay.ai"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Sprint does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/sprints/123e4567-e89b-12d3-a456-426614174000/tasks?page=1&limit=20" \
  -H "Cookie: connect.sid=session-id"
```

---

### 5. Create Sprint

**POST** `/api/sprints`

Create a new sprint with automatic overlap detection.

**Authorization**: Admin only

**Request Body**:
```json
{
  "sprintName": "Sprint 1",
  "startDate": "2025-03-01T00:00:00Z",
  "endDate": "2025-03-14T23:59:59Z",
  "goal": "Complete user authentication module"
}
```

**Validation Rules**:
- `sprintName`: Required, 1-100 characters, trimmed
- `startDate`: Required, valid ISO 8601 date
- `endDate`: Required, valid ISO 8601 date, must be after startDate
- `goal`: Optional, max 1000 characters, trimmed
- Date range must not overlap with existing sprints

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Sprint created successfully",
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-14T23:59:59Z",
    "goal": "Complete user authentication module",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

**Audit Log**: Sprint creation is logged for audit trail:
```
Sprint created: "Sprint 1" (uuid) by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Validation errors or date overlap

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
      "path": ["sprintName"],
      "message": "Sprint name is required"
    }
  ]
}
```

**Overlap Error**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Sprint dates overlap with an existing sprint"
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/sprints" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sprintName": "Sprint 1",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-14T23:59:59Z",
    "goal": "Complete user authentication module"
  }'
```

---

### 6. Update Sprint

**PUT** `/api/sprints/:id`

Update an existing sprint with overlap detection for date changes.

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Sprint ID |

**Request Body**:
```json
{
  "sprintName": "Sprint 1 - Updated",
  "startDate": "2025-03-01T00:00:00Z",
  "endDate": "2025-03-15T23:59:59Z",
  "goal": "Complete user authentication and authorization",
  "isActive": false
}
```

**Validation Rules**:
- All fields are optional, but at least one field required
- `sprintName`: 1-100 characters, trimmed
- `startDate`: Valid ISO 8601 date
- `endDate`: Valid ISO 8601 date, must be after startDate
- `goal`: Max 1000 characters, trimmed
- `isActive`: Boolean value
- Date range must not overlap with other sprints (excludes current sprint)

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Sprint updated successfully",
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1 - Updated",
    "startDate": "2025-03-01T00:00:00Z",
    "endDate": "2025-03-15T23:59:59Z",
    "goal": "Complete user authentication and authorization",
    "isActive": false,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-16T14:30:00Z"
  }
}
```

**Audit Log**: Sprint updates are logged for audit trail:
```
Sprint updated: "Sprint 1 - Updated" (uuid) by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Validation errors, date overlap, or date order invalid
- `404 Not Found`: Sprint does not exist

**Example Request**:
```bash
curl -X PUT "http://localhost:3000/api/sprints/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "sprintName": "Sprint 1 - Updated",
    "isActive": false
  }'
```

---

### 7. Delete Sprint

**DELETE** `/api/sprints/:id`

Delete a sprint with optional task handling.

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Sprint ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| moveTasksToBacklog | boolean | No | true | Move tasks to backlog (null sprint) before deletion |

**Response**: `204 No Content`

**Business Logic**:
- If sprint has tasks and `moveTasksToBacklog=false`, deletion is prevented
- If `moveTasksToBacklog=true` (default), all tasks are moved to backlog before deletion
- Tasks with `sprintId=null` are considered backlog items
- Operation is atomic using database transaction

**Audit Log**: Sprint deletion is logged for audit trail:
```
Sprint deleted: uuid by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid UUID or sprint has tasks without moveTasksToBacklog
- `404 Not Found`: Sprint does not exist

**Task Handling Error**:
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Sprint has 15 tasks. Use moveTasksToBacklog=true to delete."
}
```

**Example Requests**:

Delete sprint and move tasks to backlog (default):
```bash
curl -X DELETE "http://localhost:3000/api/sprints/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id"
```

Delete sprint without moving tasks (fails if sprint has tasks):
```bash
curl -X DELETE "http://localhost:3000/api/sprints/123e4567-e89b-12d3-a456-426614174000?moveTasksToBacklog=false" \
  -H "Cookie: connect.sid=session-id"
```

---

## Overlap Detection Logic

The sprint management system prevents overlapping sprint dates to ensure clear time boundaries. The overlap detection uses inclusive date range logic.

### Overlap Detection Algorithm

Two date ranges overlap if:
```
Range A: [startA, endA]
Range B: [startB, endB]

Overlap exists when: startA <= endB AND endA >= startB
```

### Visual Examples

**Overlap Scenarios** (BLOCKED):

```
Scenario 1: Partial Overlap at Start
Existing: |----------|
New:           |----------|
Result: BLOCKED

Scenario 2: Partial Overlap at End
Existing:      |----------|
New:      |----------|
Result: BLOCKED

Scenario 3: Complete Overlap (New surrounds Existing)
Existing:    |-----|
New:      |-----------|
Result: BLOCKED

Scenario 4: Complete Overlap (New inside Existing)
Existing: |-----------|
New:        |-----|
Result: BLOCKED

Scenario 5: Exact Match
Existing: |----------|
New:      |----------|
Result: BLOCKED
```

**Valid Scenarios** (ALLOWED):

```
Scenario 1: Adjacent (No Gap)
Existing: |----------|
New:                 |----------|
Result: ALLOWED

Scenario 2: Separated
Existing: |----------|
New:                    |----------|
Result: ALLOWED

Scenario 3: Before
Existing:              |----------|
New:      |----------|
Result: ALLOWED
```

### Implementation Details

```typescript
async checkSprintOverlap(
  startDate: Date,
  endDate: Date,
  excludeId?: string
): Promise<boolean> {
  const where = {
    AND: [
      { startDate: { lte: endDate } },
      { endDate: { gte: startDate } }
    ],
    ...(excludeId && { id: { not: excludeId } })
  };

  const overlappingSprint = await prisma.sprint.findFirst({ where });
  return overlappingSprint !== null;
}
```

### Update Operation

When updating a sprint, the current sprint is excluded from overlap detection:
- If only updating `sprintName` or `goal`, no overlap check needed
- If updating dates, overlap check runs excluding the current sprint ID
- Uses existing dates if only one date field is updated

---

## Business Rules

### Sprint Lifecycle

1. **Creation**
   - New sprints are created with `isActive=true` by default
   - Sprint dates must not overlap with existing sprints
   - Admin permission required
   - Audit log entry created

2. **Active Sprint Detection**
   - Determined by `isActive=true` AND current date between `startDate` and `endDate`
   - Only one sprint should be active at any given time
   - Frontend should query `/api/sprints/active` to get current sprint

3. **Updates**
   - Any field can be updated independently
   - Date changes trigger overlap validation
   - Can set `isActive=false` to manually end a sprint
   - Admin permission required
   - Audit log entry created

4. **Deletion**
   - Default behavior: moves all tasks to backlog (`sprintId=null`)
   - Optional: prevent deletion if sprint contains tasks
   - Uses database transaction for atomicity
   - Admin permission required
   - Audit log entry created

### Task Handling

1. **Task Assignment**
   - Tasks can be assigned to sprints during creation
   - Tasks can be moved between sprints
   - Tasks with `sprintId=null` are in backlog

2. **Sprint Deletion**
   - Default: tasks moved to backlog (remain in database)
   - Option: prevent deletion if tasks exist
   - Tasks are never automatically deleted with sprint

3. **Task Queries**
   - Use `/api/sprints/:id/tasks` for paginated task list
   - Use `?includeTasks=true` on sprint detail for embedded tasks
   - Tasks include assignee information

---

## Security Features

### 1. Input Validation

All inputs are validated using Zod schemas before processing:

```typescript
// Example: Create sprint validation
const createSprintSchema = z.object({
  sprintName: z.string().min(1).max(100).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  goal: z.string().max(1000).trim().optional()
}).refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate']
});
```

**Benefits**:
- Type safety
- SQL injection prevention
- XSS prevention through sanitization
- Clear, structured error messages
- Client-side validation can mirror server schemas

### 2. Authorization

Middleware ensures proper access control:

- **isAuthenticated**: User must be logged in (all endpoints)
- **isAdmin**: User must have admin role (create, update, delete)

**Authorization Matrix**:
| Endpoint | Method | Admin | Member |
|----------|--------|-------|--------|
| List sprints | GET | Yes | Yes |
| Get active sprint | GET | Yes | Yes |
| Get sprint by ID | GET | Yes | Yes |
| Get sprint tasks | GET | Yes | Yes |
| Create sprint | POST | Yes | No |
| Update sprint | PUT | Yes | No |
| Delete sprint | DELETE | Yes | No |

**Example Route Protection**:
```typescript
router.post('/', isAuthenticated, isAdmin, controller.createSprint);
router.put('/:id', isAuthenticated, isAdmin, controller.updateSprint);
router.delete('/:id', isAuthenticated, isAdmin, controller.deleteSprint);
```

### 3. Audit Logging

All administrative operations are logged for security and compliance:

```typescript
// Sprint creation
console.log(`Sprint created: "${sprint.sprintName}" (${sprint.id}) by ${req.user?.email}`);

// Sprint update
console.log(`Sprint updated: "${sprint.sprintName}" (${sprint.id}) by ${req.user?.email}`);

// Sprint deletion
console.log(`Sprint deleted: ${sprintId} by ${req.user?.email}`);
```

**Use Cases**:
- Security audits
- Compliance reporting
- Troubleshooting
- Change tracking
- Accountability

### 4. Overlap Prevention

Overlap detection prevents scheduling conflicts:
- Validates date ranges during creation
- Validates date ranges during updates
- Excludes current sprint during update validation
- Uses database-level date comparison for accuracy

### 5. Transactional Integrity

Critical operations use database transactions:
- Sprint deletion with task migration uses `$transaction`
- Ensures atomic operations (all succeed or all fail)
- Prevents data inconsistency

```typescript
await prisma.$transaction(async (tx) => {
  if (moveTasksToBacklog) {
    await tx.task.updateMany({
      where: { sprintId: id },
      data: { sprintId: null }
    });
  }
  await tx.sprint.delete({ where: { id } });
});
```

### 6. Rate Limiting

API endpoints are protected by rate limiting:
- 100 requests per 15 minutes per IP
- Prevents abuse and DoS attacks
- Configured in `middlewares/security.ts`

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable message",
  "details": []
}
```

### Common Error Types

**Validation Error** (400):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "code": "invalid_type",
      "expected": "date",
      "received": "string",
      "path": ["startDate"],
      "message": "Invalid start date format"
    }
  ]
}
```

**Date Overlap Error** (400):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Sprint dates overlap with an existing sprint"
}
```

**Authentication Required** (401):
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Forbidden** (403):
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Admin access required"
}
```

**Not Found** (404):
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Sprint not found"
}
```

**Task Conflict** (400):
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Sprint has 15 tasks. Use moveTasksToBacklog=true to delete."
}
```

---

## Frontend Integration Example

### React/TypeScript API Client

```typescript
// API client for sprint management
class SprintAPI {
  private baseUrl = '/api/sprints';

  async listSprints(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    includeStats?: boolean;
    sortBy?: 'startDate' | 'endDate' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}?${query}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getActiveSprint() {
    const response = await fetch(`${this.baseUrl}/active`, {
      credentials: 'include',
    });
    if (response.status === 404) {
      return null;
    }
    return response.json();
  }

  async getSprint(id: string, includeTasks = false) {
    const query = includeTasks ? '?includeTasks=true' : '';
    const response = await fetch(`${this.baseUrl}/${id}${query}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getSprintTasks(id: string, params?: {
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}/${id}/tasks?${query}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async createSprint(data: {
    sprintName: string;
    startDate: string;
    endDate: string;
    goal?: string;
  }) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateSprint(id: string, data: {
    sprintName?: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
    isActive?: boolean;
  }) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteSprint(id: string, moveTasksToBacklog = true) {
    const query = `?moveTasksToBacklog=${moveTasksToBacklog}`;
    const response = await fetch(`${this.baseUrl}/${id}${query}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.status === 204;
  }
}

export const sprintAPI = new SprintAPI();
```

### Usage in React Components

```typescript
import { useEffect, useState } from 'react';
import { sprintAPI } from './api/sprint';

// Get active sprint
function ActiveSprintCard() {
  const [sprint, setSprint] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveSprint = async () => {
      const result = await sprintAPI.getActiveSprint();
      setSprint(result?.data || null);
      setLoading(false);
    };
    fetchActiveSprint();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!sprint) return <div>No active sprint</div>;

  return (
    <div>
      <h2>{sprint.sprintName}</h2>
      <p>{sprint.goal}</p>
      <p>Tasks: {sprint._count.tasks}</p>
    </div>
  );
}

// List sprints with pagination
function SprintList() {
  const [data, setData] = useState({ sprints: [], pagination: {} });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchSprints = async () => {
      const result = await sprintAPI.listSprints({
        page,
        limit: 10,
        includeStats: true,
        sortBy: 'startDate',
        sortOrder: 'desc',
      });
      setData(result.data);
    };
    fetchSprints();
  }, [page]);

  return (
    <div>
      {data.sprints.map(sprint => (
        <div key={sprint.id}>
          <h3>{sprint.sprintName}</h3>
          <p>Tasks: {sprint._count.tasks}</p>
        </div>
      ))}
      <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
        Previous
      </button>
      <button
        onClick={() => setPage(p => p + 1)}
        disabled={page >= data.pagination.totalPages}
      >
        Next
      </button>
    </div>
  );
}

// Create sprint form
function CreateSprintForm() {
  const [formData, setFormData] = useState({
    sprintName: '',
    startDate: '',
    endDate: '',
    goal: '',
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await sprintAPI.createSprint(formData);

    if (result.success) {
      // Handle success
      console.log('Sprint created:', result.data);
    } else {
      setError(result.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Sprint Name"
        value={formData.sprintName}
        onChange={e => setFormData({...formData, sprintName: e.target.value})}
      />
      <input
        type="datetime-local"
        value={formData.startDate}
        onChange={e => setFormData({...formData, startDate: e.target.value})}
      />
      <input
        type="datetime-local"
        value={formData.endDate}
        onChange={e => setFormData({...formData, endDate: e.target.value})}
      />
      <textarea
        placeholder="Sprint Goal"
        value={formData.goal}
        onChange={e => setFormData({...formData, goal: e.target.value})}
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Create Sprint</button>
    </form>
  );
}
```

---

## Testing

### Unit Tests

Test individual service functions:

```typescript
import { sprintService } from '@/sprints/service';

describe('SprintService', () => {
  describe('listSprints', () => {
    it('should filter by isActive', async () => {
      const result = await sprintService.listSprints({
        page: 1,
        limit: 20,
        isActive: true
      });
      expect(result.sprints.every(s => s.isActive)).toBe(true);
    });

    it('should include task counts when requested', async () => {
      const result = await sprintService.listSprints({
        page: 1,
        limit: 20,
        includeStats: true
      });
      expect(result.sprints[0]).toHaveProperty('_count.tasks');
    });
  });

  describe('checkSprintOverlap', () => {
    it('should detect overlapping dates', async () => {
      // Create sprint: Mar 1-15
      await sprintService.createSprint({
        sprintName: 'Sprint 1',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-15'),
      });

      // Check overlap: Mar 10-20
      const hasOverlap = await sprintService.checkSprintOverlap(
        new Date('2025-03-10'),
        new Date('2025-03-20')
      );
      expect(hasOverlap).toBe(true);
    });

    it('should allow adjacent sprints', async () => {
      // Create sprint: Mar 1-15
      await sprintService.createSprint({
        sprintName: 'Sprint 1',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-15'),
      });

      // Check adjacent: Mar 16-30
      const hasOverlap = await sprintService.checkSprintOverlap(
        new Date('2025-03-16'),
        new Date('2025-03-30')
      );
      expect(hasOverlap).toBe(false);
    });
  });

  describe('getActiveSprint', () => {
    it('should return sprint where current date is in range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const tomorrow = new Date(now.getTime() + 86400000);

      await sprintService.createSprint({
        sprintName: 'Current Sprint',
        startDate: yesterday,
        endDate: tomorrow,
      });

      const active = await sprintService.getActiveSprint();
      expect(active).toBeTruthy();
      expect(active.sprintName).toBe('Current Sprint');
    });
  });
});
```

### Integration Tests

Test full request/response cycle:

```typescript
import request from 'supertest';
import app from '@/app';

describe('Sprint Management API', () => {
  describe('POST /api/sprints', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/sprints')
        .send({
          sprintName: 'Test Sprint',
          startDate: '2025-03-01',
          endDate: '2025-03-15',
        });
      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      // Authenticate as member
      const response = await request(app)
        .post('/api/sprints')
        .set('Cookie', memberSession)
        .send({
          sprintName: 'Test Sprint',
          startDate: '2025-03-01',
          endDate: '2025-03-15',
        });
      expect(response.status).toBe(403);
    });

    it('should create sprint with valid data', async () => {
      const response = await request(app)
        .post('/api/sprints')
        .set('Cookie', adminSession)
        .send({
          sprintName: 'Test Sprint',
          startDate: '2025-03-01T00:00:00Z',
          endDate: '2025-03-15T23:59:59Z',
          goal: 'Complete feature X',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sprintName).toBe('Test Sprint');
      expect(response.body.data.isActive).toBe(true);
    });
  });

  describe('DELETE /api/sprints/:id', () => {
    it('should move tasks to backlog by default', async () => {
      // Create sprint with tasks
      const sprint = await createTestSprint();
      const task = await createTestTask({ sprintId: sprint.id });

      // Delete sprint
      const response = await request(app)
        .delete(`/api/sprints/${sprint.id}`)
        .set('Cookie', adminSession);

      expect(response.status).toBe(204);

      // Verify task moved to backlog
      const updatedTask = await prisma.task.findUnique({
        where: { id: task.id }
      });
      expect(updatedTask.sprintId).toBeNull();
    });
  });
});
```

---

## Troubleshooting

### Issue: "Sprint dates overlap with an existing sprint"

**Cause**: Attempting to create/update a sprint with dates that overlap existing sprints

**Solution**:
1. Query existing sprints: `GET /api/sprints?sortBy=startDate`
2. Identify the conflicting sprint
3. Adjust dates to avoid overlap
4. Consider adjacent dates (end date + 1 day = start date)

**Prevention**:
- Implement calendar visualization in frontend
- Show existing sprints when creating new ones
- Validate dates client-side before submission

### Issue: "Sprint has X tasks. Use moveTasksToBacklog=true to delete"

**Cause**: Attempting to delete a sprint with tasks without specifying task handling

**Solution**:
1. Option 1: Move tasks to backlog: `DELETE /api/sprints/:id?moveTasksToBacklog=true`
2. Option 2: Reassign tasks to another sprint first
3. Option 3: Delete tasks individually before deleting sprint

**Prevention**:
- Always check task count before deletion
- Provide clear UI warnings when sprint contains tasks
- Default to moving tasks to backlog

### Issue: "No active sprint found"

**Cause**: No sprint has current date within its date range or all sprints are inactive

**Solution**:
1. Check existing sprints: `GET /api/sprints`
2. Verify current date falls within a sprint's date range
3. Ensure sprint has `isActive=true`
4. Create new sprint if needed

**Debug Query**:
```sql
SELECT * FROM sprints
WHERE isActive = true
  AND startDate <= NOW()
  AND endDate >= NOW();
```

### Issue: "End date must be after start date"

**Cause**: End date is same as or before start date

**Solution**:
1. Verify date order in request
2. Ensure timezone handling is correct
3. Use ISO 8601 format for dates
4. Check for date parsing issues

**Valid Example**:
```json
{
  "startDate": "2025-03-01T00:00:00Z",
  "endDate": "2025-03-15T23:59:59Z"
}
```

### Issue: Pagination not working correctly

**Cause**: Invalid page or limit parameters

**Solution**:
1. Ensure `page >= 1`
2. Ensure `limit` is between 1 and 100
3. Check total pages in response
4. Verify query parameter format

**Example**:
```bash
# Correct
curl "http://localhost:3000/api/sprints?page=1&limit=20"

# Incorrect
curl "http://localhost:3000/api/sprints?page=0&limit=200"
```

### Issue: Rate limit exceeded

**Cause**: Too many requests in short time period

**Solution**:
1. Implement request throttling in frontend
2. Cache sprint data when possible
3. Use WebSocket for real-time updates instead of polling
4. Contact admin to adjust limits if legitimate use case

### Issue: Tasks not showing in sprint

**Cause**: Tasks not properly assigned to sprint or pagination issue

**Solution**:
1. Verify task has correct `sprintId`
2. Check pagination parameters
3. Use `includeTasks=true` when fetching sprint
4. Query tasks endpoint: `GET /api/sprints/:id/tasks`

**Debug**:
```sql
SELECT COUNT(*) FROM tasks WHERE sprintId = 'sprint-uuid';
```

---

## Best Practices

### 1. Always Validate Dates

```typescript
// Bad: No validation
const sprint = await sprintAPI.createSprint({
  sprintName: 'Sprint 1',
  startDate: userInput.start,
  endDate: userInput.end,
});

// Good: Validate before submission
const validateDates = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format');
  }

  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  return { startDate, endDate };
};

const { startDate, endDate } = validateDates(userInput.start, userInput.end);
```

### 2. Handle Overlap Gracefully

```typescript
// Good: Provide helpful error messages
const createSprint = async (data) => {
  try {
    return await sprintAPI.createSprint(data);
  } catch (error) {
    if (error.message.includes('overlap')) {
      // Fetch existing sprints to show conflict
      const sprints = await sprintAPI.listSprints({
        sortBy: 'startDate',
        sortOrder: 'asc',
      });

      // Show conflicting sprint to user
      const conflicting = sprints.data.sprints.find(s =>
        // Find overlap logic
      );

      throw new Error(
        `Sprint dates conflict with "${conflicting.sprintName}" ` +
        `(${conflicting.startDate} - ${conflicting.endDate})`
      );
    }
    throw error;
  }
};
```

### 3. Use Active Sprint Intelligently

```typescript
// Good: Cache active sprint and refresh periodically
class SprintManager {
  private activeSprint = null;
  private lastFetch = 0;
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getActiveSprint() {
    const now = Date.now();
    if (this.activeSprint && now - this.lastFetch < this.CACHE_DURATION) {
      return this.activeSprint;
    }

    this.activeSprint = await sprintAPI.getActiveSprint();
    this.lastFetch = now;
    return this.activeSprint;
  }

  invalidateCache() {
    this.activeSprint = null;
    this.lastFetch = 0;
  }
}
```

### 4. Implement Proper Task Handling

```typescript
// Good: Warn before deleting sprint with tasks
const deleteSprint = async (sprintId) => {
  const sprint = await sprintAPI.getSprint(sprintId, false);

  if (sprint.data._count.tasks > 0) {
    const confirmed = await confirmDialog(
      `This sprint has ${sprint.data._count.tasks} tasks. ` +
      `They will be moved to the backlog. Continue?`
    );

    if (!confirmed) return;
  }

  return await sprintAPI.deleteSprint(sprintId, true);
};
```

### 5. Implement Proper Pagination

```typescript
// Good: Track pagination state properly
function SprintList() {
  const [state, setState] = useState({
    sprints: [],
    page: 1,
    totalPages: 1,
    loading: false,
  });

  const loadSprints = async (page) => {
    setState(s => ({ ...s, loading: true }));
    const result = await sprintAPI.listSprints({ page, limit: 20 });
    setState({
      sprints: result.data.sprints,
      page: result.data.pagination.page,
      totalPages: result.data.pagination.totalPages,
      loading: false,
    });
  };

  const nextPage = () => {
    if (state.page < state.totalPages) {
      loadSprints(state.page + 1);
    }
  };

  const prevPage = () => {
    if (state.page > 1) {
      loadSprints(state.page - 1);
    }
  };

  // ... render implementation
}
```

---

## Performance Considerations

### 1. Database Indexes

Ensure indexes exist on frequently queried fields:

```prisma
model Sprint {
  id        String   @id @default(uuid())
  startDate DateTime
  endDate   DateTime
  isActive  Boolean  @default(true)

  @@index([startDate, endDate])  // Composite index for date range queries
  @@index([isActive])             // Index for filtering active sprints
  @@index([createdAt])            // Index for sorting
}
```

### 2. Pagination

Always use pagination for list endpoints:

```typescript
// Good: Paginated query
const sprints = await prisma.sprint.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { startDate: 'desc' },
});

// Bad: Loading all records
const sprints = await prisma.sprint.findMany();
```

### 3. Parallel Queries

Use `Promise.all` for independent queries:

```typescript
// Good: Parallel execution
const [sprints, total] = await Promise.all([
  prisma.sprint.findMany({ where, skip, take, orderBy }),
  prisma.sprint.count({ where }),
]);

// Bad: Sequential execution
const sprints = await prisma.sprint.findMany({ where, skip, take, orderBy });
const total = await prisma.sprint.count({ where });
```

### 4. Selective Field Loading

Only load fields you need:

```typescript
// Good: Select specific fields
const sprint = await prisma.sprint.findUnique({
  where: { id },
  select: {
    id: true,
    sprintName: true,
    startDate: true,
    endDate: true,
  },
});

// Bad: Loading all fields and relations
const sprint = await prisma.sprint.findUnique({
  where: { id },
  include: { tasks: true, createdBy: true },
});
```

### 5. Caching Strategies

Implement caching for frequently accessed data:

```typescript
// Example: Cache active sprint
const CACHE_KEY = 'active-sprint';
const CACHE_TTL = 5 * 60; // 5 minutes

async function getActiveSprint() {
  // Try cache first
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  // Query database
  const sprint = await sprintService.getActiveSprint();

  // Cache result
  if (sprint) {
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(sprint));
  }

  return sprint;
}
```

---

## Related Documentation

- [Authentication & Authorization](./02-authentication.md)
- [Database Schema](./01-database-schema.md)
- [User Management](./03-user-management.md)
- [Sprint Management Plan](../plans/04-sprint-management-plan.md)

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained by**: ServiceBay.ai Development Team
