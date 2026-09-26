# User Management API Documentation

## Overview

The User Management API provides endpoints for managing users in ServiceBay PM. It implements role-based access control (RBAC), input validation, audit logging, and follows REST best practices.

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
2. **Service** (`service.ts`): Business logic and database operations
3. **Controller** (`controller.ts`): Request/response handling
4. **Routes** (`routes.ts`): RESTful endpoint definitions

## API Endpoints

### Base URL
```
/api/users
```

### Authentication
All endpoints require authentication. Include session cookie in requests.

---

### 1. List Users

**GET** `/api/users`

List all users with filtering, sorting, and pagination.

**Authorization**: Admin only

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 20 | Items per page (min: 1, max: 100) |
| role | string | No | - | Filter by role (ADMIN, MEMBER) |
| isActive | boolean | No | - | Filter by active status |
| search | string | No | - | Search by name or email (max: 100 chars) |
| sortBy | string | No | createdAt | Sort field (name, email, createdAt) |
| sortOrder | string | No | desc | Sort order (asc, desc) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@servicebay.ai",
        "name": "John Doe",
        "role": "MEMBER",
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

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid query parameters

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/users?page=1&limit=10&role=MEMBER&sortBy=name" \
  -H "Cookie: connect.sid=session-id"
```

---

### 2. Get User by ID

**GET** `/api/users/:id`

Get detailed information about a specific user.

**Authorization**: Admin or self

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| includeStats | boolean | No | false | Include user statistics |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "John Doe",
    "role": "MEMBER",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

**With Stats** (`includeStats=true`):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "John Doe",
    "role": "MEMBER",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z",
    "_count": {
      "tasksAssigned": 15,
      "tasksCreated": 8,
      "conversations": 5,
      "messagesSent": 42
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin and not self
- `400 Bad Request`: Invalid UUID format
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000?includeStats=true" \
  -H "Cookie: connect.sid=session-id"
```

---

### 3. Update User Profile

**PATCH** `/api/users/:id`

Update user's name or email.

**Authorization**: Admin or self (self can only update name)

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@servicebay.ai"
}
```

**Validation Rules**:
- `name`: Optional, 1-100 characters, trimmed
- `email`: Optional, valid email format, @servicebay.ai domain, unique
- At least one field required

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "uuid",
    "email": "jane.doe@servicebay.ai",
    "name": "Jane Doe",
    "role": "MEMBER",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin and not self
- `400 Bad Request`: Validation errors or duplicate email
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X PATCH "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'
```

---

### 4. Update User Role

**PUT** `/api/users/:id/role`

Change a user's role (Admin only).

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Request Body**:
```json
{
  "role": "ADMIN"
}
```

**Validation Rules**:
- `role`: Required, must be "ADMIN" or "MEMBER"

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "John Doe",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

**Audit Log**: Role changes are logged for security:
```
Role changed: User 123e4567-... changed to ADMIN by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid role value
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X PUT "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000/role" \
  -H "Cookie: connect.sid=session-id" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

---

### 5. Deactivate User

**DELETE** `/api/users/:id`

Deactivate a user (soft delete).

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Response**: `204 No Content`

**Notes**:
- Sets `isActive` to `false` (soft delete)
- User data is retained in database
- User cannot login while deactivated
- Operation is idempotent

**Audit Log**: Deactivation is logged for security:
```
User deactivated: 123e4567-... by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid UUID
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X DELETE "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: connect.sid=session-id"
```

---

### 6. Activate User

**POST** `/api/users/:id/activate`

Reactivate a deactivated user.

**Authorization**: Admin only

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "User activated successfully",
  "data": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "John Doe",
    "role": "MEMBER",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T14:00:00Z"
  }
}
```

**Audit Log**: Activation is logged for security:
```
User activated: 123e4567-... by admin@servicebay.ai
```

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not an admin
- `400 Bad Request`: Invalid UUID
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000/activate" \
  -H "Cookie: connect.sid=session-id"
```

---

### 7. Get User Statistics

**GET** `/api/users/:id/stats`

Get comprehensive statistics about a user's activity.

**Authorization**: Admin or self

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "tasksAssigned": 15,
    "tasksCreated": 8,
    "tasksCompleted": 5,
    "avgTaskProgress": 67.5,
    "conversations": 5,
    "messagesSent": 42
  }
}
```

**Statistics Explained**:
- `tasksAssigned`: Number of tasks assigned to user
- `tasksCreated`: Number of tasks created by user
- `tasksCompleted`: Number of tasks with 100% progress
- `avgTaskProgress`: Average progress across assigned tasks (0-100)
- `conversations`: Number of conversations user participates in
- `messagesSent`: Total messages sent by user

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin and not self
- `400 Bad Request`: Invalid UUID
- `404 Not Found`: User does not exist

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000/stats" \
  -H "Cookie: connect.sid=session-id"
```

---

## Security Features

### 1. Input Validation

All inputs are validated using Zod schemas before processing:

```typescript
// Example: Update user validation
{
  name: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().refine(email => email.endsWith('@servicebay.ai')).optional()
}
```

**Benefits**:
- Type safety
- SQL injection prevention
- XSS prevention through sanitization
- Clear error messages

### 2. Authorization

Middleware ensures proper access control:

- **isAuthenticated**: User must be logged in
- **isAdmin**: User must have admin role
- **isAdminOrOwner**: User must be admin or the resource owner

**Example Route Protection**:
```typescript
router.patch('/:id', isAuthenticated, isAdminOrOwner, controller.updateUser);
```

### 3. Audit Logging

Security-sensitive operations are logged:

```typescript
console.log(`Role changed: User ${userId} changed to ${role} by ${req.user?.email}`);
console.log(`User deactivated: ${userId} by ${req.user?.email}`);
console.log(`User activated: ${userId} by ${req.user?.email}`);
```

**Use Cases**:
- Security audits
- Compliance reporting
- Troubleshooting
- Accountability

### 4. Soft Deletes

Users are never permanently deleted from the database:

- Deactivation sets `isActive = false`
- User data retained for audit trail
- Can be reactivated by admin
- Prevents accidental data loss

### 5. Rate Limiting

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
  "details": [] // Optional: validation errors
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
      "code": "too_small",
      "minimum": 1,
      "path": ["name"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
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
  "message": "Insufficient permissions"
}
```

**Not Found** (404):
```json
{
  "success": false,
  "error": "Not Found",
  "message": "User not found"
}
```

---

## Usage Examples

### Frontend Integration

**React/TypeScript Example**:

```typescript
// API client
class UserAPI {
  private baseUrl = '/api/users';

  async listUsers(params?: {
    page?: number;
    limit?: number;
    role?: 'ADMIN' | 'MEMBER';
    search?: string;
  }) {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseUrl}?${query}`, {
      credentials: 'include', // Include session cookie
    });
    return response.json();
  }

  async getUser(id: string, includeStats = false) {
    const query = includeStats ? '?includeStats=true' : '';
    const response = await fetch(`${this.baseUrl}/${id}${query}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async updateUser(id: string, data: { name?: string; email?: string }) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateRole(id: string, role: 'ADMIN' | 'MEMBER') {
    const response = await fetch(`${this.baseUrl}/${id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    return response.json();
  }

  async deactivateUser(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.status === 204;
  }

  async activateUser(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}/activate`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.json();
  }

  async getUserStats(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}/stats`, {
      credentials: 'include',
    });
    return response.json();
  }
}

export const userAPI = new UserAPI();
```

**Usage in Components**:

```typescript
// List users with search
const { data } = await userAPI.listUsers({
  page: 1,
  limit: 20,
  search: 'john',
  role: 'MEMBER',
});

// Get user profile
const { data: user } = await userAPI.getUser(userId, true);

// Update profile
await userAPI.updateUser(userId, { name: 'New Name' });

// Make user admin
await userAPI.updateRole(userId, 'ADMIN');
```

---

## Best Practices

### 1. Always Validate Input

```typescript
// ❌ Bad
const data = req.body;
await userService.updateUser(userId, data);

// ✅ Good
const data = updateUserSchema.parse(req.body);
await userService.updateUser(userId, data);
```

### 2. Handle Errors Properly

```typescript
try {
  const result = await userService.updateUser(userId, data);
  res.json({ success: true, data: result });
} catch (error) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.errors,
    });
  }
  next(error); // Let global error handler deal with it
}
```

### 3. Use Proper HTTP Methods

- `GET`: Retrieve data
- `POST`: Create or trigger action
- `PUT`: Full replacement or specific update
- `PATCH`: Partial update
- `DELETE`: Remove/deactivate

### 4. Implement Pagination

Always paginate list endpoints to prevent performance issues:

```typescript
const { users, pagination } = await userService.listUsers({
  page: 1,
  limit: 20,
});
```

### 5. Log Security Events

```typescript
console.log(`Role changed: User ${userId} to ${role} by ${req.user?.email}`);
```

---

## Testing

### Unit Tests

Test individual service functions:

```typescript
describe('UserService.listUsers', () => {
  it('should filter by role', async () => {
    const result = await userService.listUsers({ role: Role.ADMIN });
    expect(result.users.every(u => u.role === Role.ADMIN)).toBe(true);
  });
});
```

### Integration Tests

Test full request/response cycle:

```typescript
describe('GET /api/users', () => {
  it('should require admin authentication', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(401);
  });
});
```

---

## Performance Considerations

### 1. Database Indexes

Ensure indexes exist on frequently queried fields:

```prisma
model User {
  email String @unique // Index created automatically
  role  Role   @default(MEMBER)

  @@index([role]) // Add index for role filtering
  @@index([isActive]) // Add index for active filtering
}
```

### 2. Pagination

Always use limit and offset for large datasets:

```typescript
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
});
```

### 3. Parallel Queries

Use `Promise.all` for independent queries:

```typescript
const [users, total] = await Promise.all([
  prisma.user.findMany({ where, skip, take }),
  prisma.user.count({ where }),
]);
```

---

## Troubleshooting

### Issue: "Authentication required" error

**Cause**: No session cookie or expired session

**Solution**:
1. Verify user is logged in
2. Check session cookie is included in request
3. Ensure `credentials: 'include'` in fetch options

### Issue: "Forbidden" error

**Cause**: Insufficient permissions

**Solution**:
1. Verify user role (admin vs member)
2. Check if accessing own resource vs others'
3. Review route authorization middleware

### Issue: Validation errors

**Cause**: Invalid input data

**Solution**:
1. Check error details for specific validation failures
2. Ensure data types match schema requirements
3. Verify email domain is @servicebay.ai

### Issue: Rate limit exceeded

**Cause**: Too many requests in short time

**Solution**:
1. Implement request throttling in frontend
2. Cache frequently accessed data
3. Contact admin to adjust limits if needed

---

## Related Documentation

- [Authentication & Authorization](./02-authentication.md)
- [Database Schema](./01-database-schema.md)
- [User Management Plan](../plans/03-user-management-plan.md)

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained by**: ServiceBay.ai Development Team
