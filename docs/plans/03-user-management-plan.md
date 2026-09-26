# Feature Plan: User Management API

## Overview
Implement RESTful API endpoints for user CRUD operations with role-based access control, following REST API best practices for 2025.

## Research Summary (2025 Best Practices)

### REST API Design
- **HTTP Methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Resource Naming**: Plural nouns (`/users` not `/user`)
- **No verbs in URLs**: `/users/{id}` not `/getUser/{id}`
- **Consistent URL structure**: Always lowercase, hyphens for multi-word
- **Proper HTTP status codes**: 200, 201, 204, 400, 401, 403, 404, 500
- **Filtering & Pagination**: Query parameters (`?role=admin&page=1&limit=10`)
- **Partial updates**: PATCH for partial, PUT for full replacement

### User Management Specifics
- List users with pagination
- Filter by role, status, search query
- Get user by ID (UUID)
- Update user profile (name, picture)
- Update user role (admin only)
- Deactivate user (soft delete)
- No password management (OAuth only)

## API Endpoints

### GET /api/users
List all users (paginated).

**Auth**: Admin only

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `role` (ADMIN | MEMBER)
- `isActive` (boolean)
- `search` (string, searches name and email)
- `sortBy` (name | email | createdAt, default: createdAt)
- `sortOrder` (asc | desc, default: desc)

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@servicebay.ai",
        "name": "User Name",
        "picture": "https://...",
        "role": "MEMBER",
        "isActive": true,
        "createdAt": "2025-01-10T10:00:00Z",
        "updatedAt": "2025-01-10T10:00:00Z"
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

### GET /api/users/:id
Get user by ID.

**Auth**: Admin or self

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "User Name",
    "picture": "https://...",
    "role": "MEMBER",
    "isActive": true,
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-10T10:00:00Z",
    "stats": {
      "tasksAssigned": 5,
      "tasksCreated": 2,
      "tasksCompleted": 3
    }
  }
}
```

### PATCH /api/users/:id
Update user (partial update).

**Auth**: Admin or self (self can only update name)

**Body**:
```json
{
  "name": "New Name"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "New Name",
    "picture": "https://...",
    "role": "MEMBER",
    "isActive": true,
    "updatedAt": "2025-01-10T10:30:00Z"
  }
}
```

### PUT /api/users/:id/role
Update user role (admin only).

**Auth**: Admin only

**Body**:
```json
{
  "role": "ADMIN"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "message": "User role updated",
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "role": "ADMIN"
  }
}
```

### DELETE /api/users/:id
Deactivate user (soft delete).

**Auth**: Admin only

**Response**: 204 No Content

### POST /api/users/:id/activate
Reactivate deactivated user.

**Auth**: Admin only

**Response**: 200 OK
```json
{
  "success": true,
  "message": "User activated",
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "isActive": true
  }
}
```

### GET /api/users/:id/stats
Get user statistics.

**Auth**: Admin or self

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "tasksAssigned": 5,
    "tasksCreated": 2,
    "tasksCompleted": 3,
    "avgTaskProgress": 60,
    "conversations": 3,
    "messagesSent": 45
  }
}
```

## Validation Rules

### Query Parameters
```typescript
const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(100).optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Update User
```typescript
const updateUserSchema = z.object({
  name: z.string().min(1).max(100),
});
```

### Update Role
```typescript
const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});
```

## Implementation Structure

```
server/src/users/
├── controller.ts      # Request handlers
├── service.ts         # Business logic
├── validators.ts      # Zod schemas
├── routes.ts          # Route definitions
└── types.ts           # TypeScript types
```

## Security Considerations

1. **Authorization**:
   - Only admins can list all users
   - Users can only view/update themselves
   - Only admins can change roles
   - Only admins can deactivate users

2. **Input Validation**:
   - Zod schema validation on all inputs
   - Sanitize search queries
   - Limit query string lengths

3. **Rate Limiting**:
   - Standard API rate limit (100 req/15min)
   - No special limits needed for user endpoints

4. **Data Exposure**:
   - Never expose password hashes (we don't have any)
   - Don't expose sensitive session data
   - Filter fields based on requester role

5. **Audit Logging**:
   - Log role changes
   - Log user deactivations
   - Log failed access attempts

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "field": "page",
      "message": "Must be a positive integer"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "You must be logged in"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "User not found"
}
```

## Testing Strategy

### Unit Tests
- Service functions (list, get, update, delete)
- Validators (Zod schemas)
- Permission checks

### Integration Tests
- GET /api/users (with different filters)
- GET /api/users/:id
- PATCH /api/users/:id (self and admin)
- PUT /api/users/:id/role (admin only)
- DELETE /api/users/:id (admin only)
- POST /api/users/:id/activate

### Test Scenarios
- Admin lists all users
- Member tries to list users (403)
- Admin gets any user
- Member gets self
- Member tries to get other user (403)
- Admin updates user role
- Member tries to update role (403)
- User updates own name
- Admin deactivates user
- User cannot login when deactivated

## Implementation Steps

1. Create validators (Zod schemas)
2. Create service layer (business logic)
3. Create controller (request handlers)
4. Create routes
5. Add to main app
6. Write unit tests
7. Write integration tests
8. Create documentation
9. Add to CI/CD

## Performance Optimization

- Index on email, role, isActive (already exists)
- Use select to limit returned fields
- Implement cursor-based pagination (future)
- Cache user stats (future)

## Success Criteria

- ✅ All endpoints work correctly
- ✅ Authorization enforced properly
- ✅ Input validation works
- ✅ Pagination works
- ✅ Filtering works
- ✅ Sorting works
- ✅ Error handling comprehensive
- ✅ Tests pass with >80% coverage
- ✅ Documentation complete
- ✅ CI/CD pipeline passes
