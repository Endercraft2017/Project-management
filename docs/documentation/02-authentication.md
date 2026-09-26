# Authentication & Authorization Documentation

## Overview

ServiceBay PM uses Google OAuth 2.0 for authentication, restricted to `@servicebay.ai` domain users. The system implements role-based access control (RBAC) with two roles: Admin and Member.

## Architecture

### Authentication Flow

```
┌──────────┐                ┌──────────────┐                ┌──────────────┐
│  Client  │                │    Server    │                │   Google     │
│ (React)  │                │  (Express)   │                │    OAuth     │
└────┬─────┘                └──────┬───────┘                └──────┬───────┘
     │                             │                               │
     │ 1. Click "Login"            │                               │
     ├────────────────────────────>│                               │
     │                             │                               │
     │ 2. Redirect to Google       │                               │
     │<────────────────────────────┤                               │
     │                             │                               │
     │ 3. Login with Google        │                               │
     ├─────────────────────────────────────────────────────────────>│
     │                             │                               │
     │ 4. Google Callback          │                               │
     │<────────────────────────────────────────────────────────────┤
     │                             │                               │
     │ 5. Callback to server       │                               │
     ├────────────────────────────>│                               │
     │                             │                               │
     │                             │ 6. Validate Domain            │
     │                             ├──────────┐                    │
     │                             │          │                    │
     │                             │<─────────┘                    │
     │                             │                               │
     │                             │ 7. Create/Update User         │
     │                             ├──────────┐                    │
     │                             │          │                    │
     │                             │<─────────┘                    │
     │                             │                               │
     │                             │ 8. Create Session             │
     │                             ├──────────┐                    │
     │                             │          │                    │
     │                             │<─────────┘                    │
     │                             │                               │
     │ 9. Redirect to Dashboard    │                               │
     │<────────────────────────────┤                               │
     │                             │                               │
     │ 10. Set Cookie              │                               │
     │<────────────────────────────┤                               │
     │                             │                               │
```

## Components

### 1. Passport.js Configuration

**File**: `server/src/auth/passport-config.ts`

Implements Google OAuth 2.0 strategy with:
- Domain validation (@servicebay.ai)
- Automatic role assignment (Admin/Member)
- User creation/update on login
- Session serialization/deserialization

**Key Functions**:
- `isValidDomain(email)`: Validates email domain
- `shouldBeAdmin(email)`: Checks if user should be admin
- `serialize/deserializeUser`: Session management

### 2. Authentication Middleware

**File**: `server/src/auth/middleware.ts`

**Available Middleware**:

#### `isAuthenticated`
Checks if user is logged in.

```typescript
app.get('/api/protected', isAuthenticated, (req, res) => {
  // Only authenticated users can access
});
```

#### `isAdmin`
Checks if user has admin role.

```typescript
app.post('/api/admin-only', isAdmin, (req, res) => {
  // Only admins can access
});
```

#### `isAdminOrOwner`
Checks if user is admin or resource owner.

```typescript
app.put('/api/users/:userId', isAdminOrOwner, (req, res) => {
  // Admin or user themselves can access
});
```

#### `hasRole(...roles)`
Checks if user has specific role(s).

```typescript
app.get('/api/special', hasRole(Role.ADMIN, Role.MEMBER), (req, res) => {
  // Users with specified roles can access
});
```

### 3. Auth Routes

**File**: `server/src/auth/routes.ts`

#### Public Endpoints (No Authentication)

**GET /auth/google**
- Initiates Google OAuth flow
- Redirects to Google login page
- Includes `hd` parameter to hint @servicebay.ai domain

**GET /auth/google/callback**
- Handles OAuth callback from Google
- Validates user domain
- Creates/updates user in database
- Creates session
- Redirects to dashboard or login page (on error)

**GET /auth/check**
- Checks if user is authenticated
- Returns user info if logged in
- Used by frontend to check auth status

```json
// Response when authenticated
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "User Name",
    "picture": "https://...",
    "role": "MEMBER"
  }
}
```

#### Protected Endpoints (Authentication Required)

**GET /auth/me**
- Returns current user information
- Requires authentication

```json
// Response
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@servicebay.ai",
    "name": "User Name",
    "picture": "https://...",
    "role": "MEMBER"
  }
}
```

**POST /auth/logout**
- Logs out user
- Destroys session
- Clears cookies

```json
// Response
{
  "success": true,
  "message": "Logged out successfully"
}
```

**GET /auth/session**
- Returns session information
- For debugging purposes

## Session Management

### Configuration

**File**: `server/src/middlewares/session.ts`

**Storage**: PostgreSQL (via `connect-pg-simple`)
- Sessions stored in `session` table
- Automatic table creation
- Expired sessions pruned every 15 minutes

**Cookie Settings**:
```javascript
{
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  httpOnly: true,                    // Prevent JavaScript access
  secure: true,                      // HTTPS only (production)
  sameSite: 'strict',                // CSRF protection
  path: '/',
  name: 'connect.sid'
}
```

**Session Table Schema**:
```sql
CREATE TABLE session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session(expire);
```

## Security Features

### 1. Domain Validation

**Server-side validation** (never trust client):
```typescript
if (!profile.emails[0].value.endsWith('@servicebay.ai')) {
  return done(new Error('Invalid domain'));
}
```

### 2. Secure Cookies

- **HttpOnly**: Prevents JavaScript access (XSS protection)
- **Secure**: HTTPS-only transmission (production)
- **SameSite=Strict**: CSRF protection
- **7-day expiry**: Balance security and UX

### 3. Rate Limiting

**File**: `server/src/middlewares/security.ts`

**General API**: 100 requests per 15 minutes
```typescript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

**Auth endpoints**: 5 attempts per 15 minutes
```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});
```

### 4. Security Headers

Using `helmet.js`:
- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)

### 5. Input Sanitization

Removes `<script>` tags from all input:
```typescript
export function sanitizeInput(req, res, next) {
  // Sanitizes req.body, req.query, req.params
}
```

## Role-Based Access Control (RBAC)

### Roles

1. **ADMIN**
   - Full access to all features
   - Can manage users
   - Can sync Google Sheets
   - Can create/edit/delete all tasks
   - Can access all chat conversations

2. **MEMBER**
   - Can view assigned tasks
   - Can create subtasks
   - Can update own task progress
   - Can participate in assigned chats
   - Cannot manage users
   - Cannot sync Google Sheets

### Admin Designation

Admins are designated via environment variable:

```bash
ADMIN_EMAILS=admin@servicebay.ai,manager@servicebay.ai
```

On login, user role is automatically assigned based on email.

## Error Handling

### Authentication Errors

**Invalid Domain**:
```json
{
  "success": false,
  "error": "Invalid domain",
  "message": "Email must be from @servicebay.ai domain"
}
```

**Unauthorized**:
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "You must be logged in to access this resource"
}
```

**Forbidden**:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Admin access required"
}
```

**Rate Limited**:
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Too many requests from this IP, please try again later"
}
```

## Environment Variables

Required environment variables:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://your-app.railway.app/auth/google/callback

# Session
SESSION_SECRET=minimum-32-character-random-string
SESSION_MAX_AGE=604800000  # 7 days in milliseconds

# Admin
ADMIN_EMAILS=admin1@servicebay.ai,admin2@servicebay.ai

# CORS
CORS_ORIGIN=https://your-frontend.com
CLIENT_URL=https://your-frontend.com

# Database
DATABASE_URL=postgresql://...
```

## Usage Examples

### Frontend Integration

#### Check Authentication Status

```typescript
async function checkAuth() {
  const response = await fetch('/auth/check', {
    credentials: 'include', // Important!
  });
  const data = await response.json();

  if (data.authenticated) {
    console.log('User:', data.user);
  }
}
```

#### Login

```typescript
function login() {
  // Redirect to OAuth flow
  window.location.href = '/auth/google';
}
```

#### Logout

```typescript
async function logout() {
  const response = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  if (response.ok) {
    window.location.href = '/login';
  }
}
```

#### Protected API Request

```typescript
async function fetchProtectedData() {
  const response = await fetch('/api/tasks', {
    credentials: 'include', // Send cookies
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Not authenticated
    window.location.href = '/login';
  }

  return response.json();
}
```

## Testing

### Unit Tests

Test middleware functions:
```typescript
describe('isAuthenticated middleware', () => {
  it('should block unauthenticated requests', () => {
    // Test implementation
  });
});
```

### Integration Tests

Test full auth flow:
```typescript
describe('Authentication Flow', () => {
  it('should redirect to Google OAuth', async () => {
    const response = await request(app).get('/auth/google');
    expect(response.status).toBe(302);
  });
});
```

## Troubleshooting

### Common Issues

**1. Session not persisting**
- Check `credentials: 'include'` in fetch requests
- Verify cookie settings (secure, sameSite)
- Check CORS origin configuration

**2. "Invalid domain" error**
- Verify email ends with @servicebay.ai
- Check server-side validation logic

**3. Rate limit errors**
- Wait 15 minutes
- Check IP address
- Verify rate limit configuration

**4. OAuth callback fails**
- Verify Google Cloud credentials
- Check callback URL matches Google Console
- Verify DATABASE_URL is correct

## Security Best Practices

1. ✅ **Never expose tokens** to client-side JavaScript
2. ✅ **Always validate domain** server-side
3. ✅ **Use HTTPS** in production
4. ✅ **Rotate SESSION_SECRET** regularly
5. ✅ **Monitor authentication logs** for suspicious activity
6. ✅ **Keep dependencies updated** (`npm audit`)
7. ✅ **Use environment variables** for secrets
8. ✅ **Implement rate limiting** on auth endpoints
9. ✅ **Enable CSRF protection** (SameSite cookies)
10. ✅ **Log authentication events** for audit trail

## Monitoring & Logging

### Events to Log

- Successful login (user email, IP, timestamp)
- Failed login attempt (reason, IP, timestamp)
- Logout (user email, timestamp)
- Role change (admin, target user, timestamp)
- Session expiry (user email, timestamp)
- Rate limit violations (IP, endpoint, timestamp)

### Log Format

```json
{
  "timestamp": "2025-01-10T10:00:00Z",
  "event": "login_success",
  "user": "user@servicebay.ai",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

## Future Enhancements

- [ ] Multi-factor authentication (MFA)
- [ ] Email verification
- [ ] Password reset (if adding local auth)
- [ ] Session device management
- [ ] Login history
- [ ] Suspicious activity alerts
- [ ] IP whitelisting
- [ ] OAuth token refresh
