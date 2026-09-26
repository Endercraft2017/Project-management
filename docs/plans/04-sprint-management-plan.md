# Sprint Management API - Implementation Plan

## Overview

Implement REST API for sprint management with CRUD operations, validation, date range constraints, and business logic for agile sprint planning.

## Research Summary (January 2025)

### Industry Best Practices

**Jira Software REST API Patterns**:
- Sprint endpoints follow RESTful conventions
- Required fields: sprint name, origin board
- Optional fields: start date, end date, goal
- Support for moving issues to backlog on sprint deletion

**Agile Project Management Best Practices**:
- Common sprint cadence: 1-4 weeks
- Teams should work autonomously along value streams
- Create 6+ iterations for 3-6 month planning
- Clear sprint goals and acceptance criteria
- Daily status updates for accurate burndown tracking

**Date Range Validation**:
- Overlap detection: `A.start <= B.end AND B.start <= A.end`
- Validate `startDate < endDate` before saving
- Prevent overlapping sprints (business rule)
- Support active sprint detection via date ranges

### REST API Design Principles 2025

1. **Stateless operations**: No server-side session state
2. **Resource-based URLs**: `/api/sprints/:id`
3. **Proper HTTP methods**: GET, POST, PUT, DELETE
4. **Input validation**: Zod schemas for type safety
5. **Error handling**: Standard error responses
6. **Authorization**: Role-based access control

## Database Schema (Already Implemented)

```prisma
model Sprint {
  id          String   @id @default(uuid())
  sprintName  String
  startDate   DateTime
  endDate     DateTime
  goal        String?  @db.Text
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks       Task[]

  @@index([startDate])
  @@index([endDate])
  @@index([isActive])
}
```

## API Endpoints

### 1. List All Sprints
**GET** `/api/sprints`

**Query Parameters**:
- `page` (number, default: 1, min: 1)
- `limit` (number, default: 20, min: 1, max: 100)
- `isActive` (boolean, optional) - Filter by active status
- `includeStats` (boolean, default: false) - Include task counts
- `sortBy` (enum: 'startDate' | 'endDate' | 'createdAt', default: 'startDate')
- `sortOrder` (enum: 'asc' | 'desc', default: 'desc')

**Authorization**: Authenticated users (both Admin and Member)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "uuid",
        "sprintName": "Sprint 1",
        "startDate": "2025-01-15T00:00:00Z",
        "endDate": "2025-01-29T23:59:59Z",
        "goal": "Complete user authentication",
        "isActive": true,
        "createdAt": "2025-01-10T10:00:00Z",
        "updatedAt": "2025-01-10T10:00:00Z",
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

**Errors**:
- 401: Not authenticated
- 400: Invalid query parameters

---

### 2. Get Sprint by ID
**GET** `/api/sprints/:id`

**Path Parameters**:
- `id` (UUID, required)

**Query Parameters**:
- `includeTasks` (boolean, default: false) - Include associated tasks

**Authorization**: Authenticated users

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-01-15T00:00:00Z",
    "endDate": "2025-01-29T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-10T10:00:00Z",
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
    "startDate": "2025-01-15T00:00:00Z",
    "endDate": "2025-01-29T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "tasks": [
      {
        "id": "uuid",
        "taskName": "Setup OAuth",
        "progress": 75
      }
    ]
  }
}
```

**Errors**:
- 401: Not authenticated
- 400: Invalid UUID
- 404: Sprint not found

---

### 3. Create Sprint
**POST** `/api/sprints`

**Authorization**: Admin only

**Request Body**:
```json
{
  "sprintName": "Sprint 2",
  "startDate": "2025-02-01T00:00:00Z",
  "endDate": "2025-02-14T23:59:59Z",
  "goal": "Implement task management"
}
```

**Validation Rules**:
- `sprintName`: Required, 1-100 characters, trimmed
- `startDate`: Required, valid ISO 8601 date
- `endDate`: Required, valid ISO 8601 date, must be after startDate
- `goal`: Optional, max 1000 characters, trimmed

**Business Logic**:
1. Validate `endDate > startDate`
2. Check for overlapping sprints
3. Auto-set `isActive = true`

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Sprint created successfully",
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 2",
    "startDate": "2025-02-01T00:00:00Z",
    "endDate": "2025-02-14T23:59:59Z",
    "goal": "Implement task management",
    "isActive": true,
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T10:00:00Z"
  }
}
```

**Errors**:
- 401: Not authenticated
- 403: Not an admin
- 400: Validation errors or overlapping sprint

---

### 4. Update Sprint
**PUT** `/api/sprints/:id`

**Authorization**: Admin only

**Path Parameters**:
- `id` (UUID, required)

**Request Body**:
```json
{
  "sprintName": "Sprint 2 Updated",
  "startDate": "2025-02-01T00:00:00Z",
  "endDate": "2025-02-15T23:59:59Z",
  "goal": "Updated goal"
}
```

**Validation Rules**:
- At least one field required
- Same validation as create

**Business Logic**:
1. Validate `endDate > startDate` if both provided
2. Check for overlapping with other sprints (exclude current)
3. Preserve existing values for omitted fields

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Sprint updated successfully",
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 2 Updated",
    "startDate": "2025-02-01T00:00:00Z",
    "endDate": "2025-02-15T23:59:59Z",
    "goal": "Updated goal",
    "isActive": true,
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T15:00:00Z"
  }
}
```

**Errors**:
- 401: Not authenticated
- 403: Not an admin
- 400: Validation errors or overlapping sprint
- 404: Sprint not found

---

### 5. Delete Sprint
**DELETE** `/api/sprints/:id`

**Authorization**: Admin only

**Path Parameters**:
- `id` (UUID, required)

**Query Parameters**:
- `moveTasksToBacklog` (boolean, default: true) - Move tasks to null sprint

**Business Logic**:
1. Check if sprint has tasks
2. If `moveTasksToBacklog=true`: Set tasks' sprintId to null
3. If `moveTasksToBacklog=false` and has tasks: Return error
4. Delete sprint record

**Response** (204 No Content)

**Errors**:
- 401: Not authenticated
- 403: Not an admin
- 400: Sprint has tasks and moveTasksToBacklog=false
- 404: Sprint not found

---

### 6. Get Sprint Tasks
**GET** `/api/sprints/:id/tasks`

**Authorization**: Authenticated users

**Path Parameters**:
- `id` (UUID, required)

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response** (200 OK):
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
        "taskName": "Setup OAuth",
        "progress": 75,
        "assignedTo": {
          "id": "uuid",
          "name": "John Doe"
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

**Errors**:
- 401: Not authenticated
- 400: Invalid UUID or query params
- 404: Sprint not found

---

### 7. Get Active Sprint
**GET** `/api/sprints/active`

Get currently active sprint based on date range.

**Authorization**: Authenticated users

**Business Logic**:
- Find sprint where `isActive = true` AND `startDate <= NOW() <= endDate`
- Return 404 if no active sprint

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sprintName": "Sprint 1",
    "startDate": "2025-01-15T00:00:00Z",
    "endDate": "2025-01-29T23:59:59Z",
    "goal": "Complete user authentication",
    "isActive": true,
    "_count": {
      "tasks": 15
    }
  }
}
```

**Errors**:
- 401: Not authenticated
- 404: No active sprint found

---

## Validation Schemas (Zod)

### List Sprints Query Schema
```typescript
export const listSprintsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
  includeStats: z.coerce.boolean().default(false),
  sortBy: z.enum(['startDate', 'endDate', 'createdAt']).default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Create Sprint Schema
```typescript
export const createSprintSchema = z.object({
  sprintName: z.string().min(1).max(100).trim(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  goal: z.string().max(1000).trim().optional(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);
```

### Update Sprint Schema
```typescript
export const updateSprintSchema = z.object({
  sprintName: z.string().min(1).max(100).trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  goal: z.string().max(1000).trim().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field is required',
  }
);
```

### UUID Schema (reuse from users)
```typescript
export const uuidSchema = z.string().uuid('Invalid UUID format');
```

---

## Service Layer Functions

### `listSprints(query)`
- Build where clause from filters
- Execute parallel queries: findMany + count
- Calculate pagination metadata
- Include task counts if requested

### `getSprintById(id, includeTasks)`
- Find sprint by ID
- Include tasks if requested
- Return null if not found

### `createSprint(data)`
- Check for overlapping sprints
- Create sprint record
- Return created sprint

### `updateSprint(id, data)`
- Find existing sprint
- Check for overlapping (exclude current)
- Update sprint record
- Return updated sprint

### `deleteSprint(id, moveTasksToBacklog)`
- Find sprint with task count
- If moveTasksToBacklog: Update tasks to null sprint
- Delete sprint
- Return void

### `getSprintTasks(id, page, limit)`
- Find sprint by ID
- Get associated tasks with pagination
- Include assignee info
- Return tasks + pagination

### `getActiveSprint()`
- Find sprint where isActive=true AND date range matches current date
- Return null if not found

### Helper: `checkSprintOverlap(startDate, endDate, excludeId?)`
- Query for overlapping sprints
- Use logic: `A.start <= B.end AND B.start <= A.end`
- Exclude current sprint if updating
- Return boolean

---

## Controller Layer

Each controller method:
1. Validates input using Zod schemas
2. Handles ZodError → 400 response
3. Calls service layer
4. Returns standardized response
5. Passes other errors to global handler

### Example: `createSprint`
```typescript
async createSprint(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSprintSchema.parse(req.body);

    // Check overlap
    const hasOverlap = await sprintService.checkSprintOverlap(
      data.startDate,
      data.endDate
    );

    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Sprint dates overlap with existing sprint',
      });
    }

    const sprint = await sprintService.createSprint(data);

    res.status(201).json({
      success: true,
      message: 'Sprint created successfully',
      data: sprint,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid input',
        details: error.errors,
      });
    }
    next(error);
  }
}
```

---

## Routes Configuration

```typescript
import { Router } from 'express';
import { sprintController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

// Public (authenticated) routes
router.get('/', isAuthenticated, sprintController.listSprints);
router.get('/active', isAuthenticated, sprintController.getActiveSprint);
router.get('/:id', isAuthenticated, sprintController.getSprintById);
router.get('/:id/tasks', isAuthenticated, sprintController.getSprintTasks);

// Admin-only routes
router.post('/', isAuthenticated, isAdmin, sprintController.createSprint);
router.put('/:id', isAuthenticated, isAdmin, sprintController.updateSprint);
router.delete('/:id', isAuthenticated, isAdmin, sprintController.deleteSprint);

export default router;
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable message",
  "details": [] // Optional
}
```

### Error Cases

**Overlapping Sprint**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Sprint dates overlap with existing sprint"
}
```

**Invalid Date Range**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "message": "End date must be after start date",
      "path": ["endDate"]
    }
  ]
}
```

**Sprint Has Tasks (delete without moveTasksToBacklog)**:
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Sprint has 15 tasks. Use moveTasksToBacklog=true to delete."
}
```

---

## Testing Strategy

### Unit Tests (Service Layer)

1. **listSprints**:
   - Test filtering by isActive
   - Test pagination calculation
   - Test includeStats option
   - Test sorting

2. **checkSprintOverlap**:
   - No overlap: Before, after
   - Overlap: Partial, complete, surrounding
   - Edge cases: Same start, same end

3. **createSprint**:
   - Valid sprint creation
   - Overlap detection

4. **updateSprint**:
   - Partial updates
   - Overlap detection (excluding self)
   - Non-existent sprint

5. **deleteSprint**:
   - With moveTasksToBacklog=true
   - With moveTasksToBacklog=false and tasks
   - Without tasks

### Integration Tests

1. **Authorization**:
   - Unauthenticated access denied
   - Member can read
   - Admin can create/update/delete

2. **CRUD Operations**:
   - Create → Read → Update → Delete flow
   - Validation errors
   - Not found errors

3. **Business Logic**:
   - Overlap prevention
   - Task backlog movement
   - Active sprint detection

4. **Edge Cases**:
   - Creating sprint with past dates
   - Multiple active sprints
   - Deleting sprint with tasks

---

## Files to Create

1. **server/src/sprints/validators.ts**
   - Zod schemas for validation

2. **server/src/sprints/service.ts**
   - Business logic and database operations

3. **server/src/sprints/controller.ts**
   - Request handlers

4. **server/src/sprints/routes.ts**
   - Route definitions

5. **server/src/app.ts**
   - Add sprint routes: `app.use('/api/sprints', sprintRoutes)`

6. **tests/feature/sprint-management.test.ts**
   - Comprehensive integration tests

7. **tests/CI_CD/sprint-management-ci.yml**
   - CI/CD workflow

8. **docs/documentation/04-sprint-management.md**
   - API documentation

---

## Security Considerations

1. **Authorization**: Admin-only for CUD operations
2. **Input Validation**: Zod schemas prevent injection
3. **Business Rules**: Overlap prevention
4. **Soft Deletes**: Consider adding isDeleted flag instead of hard delete
5. **Audit Logging**: Log sprint creation/modification by admin

---

## Performance Optimizations

1. **Database Indexes**: Already exist on startDate, endDate, isActive
2. **Pagination**: Mandatory for list operations
3. **Parallel Queries**: Use Promise.all for count + list
4. **Selective Inclusion**: Optional task loading
5. **Date Queries**: Use indexed date fields for active sprint

---

## Future Enhancements

1. **Sprint Templates**: Predefined goals and duration
2. **Sprint Burndown**: Calculate progress automatically
3. **Sprint Capacity**: Track team capacity vs. assigned work
4. **Sprint History**: Archive completed sprints
5. **Velocity Tracking**: Calculate team velocity across sprints

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
**Estimated Effort**: 3-4 hours
