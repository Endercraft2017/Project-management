# Feature Plan: Authentication & Authorization (Google OAuth 2.0)

## Overview
Implement secure authentication using Google OAuth 2.0 with Passport.js, restricted to @servicebay.ai domain, with role-based access control and secure session management.

## Research Summary (2025 Best Practices)

### Google OAuth 2.0
- Use `passport-google-oauth20` strategy
- Implement incremental authorization (request permissions as needed)
- Store tokens securely server-side only
- Validate domain (@servicebay.ai) on both client and server
- Use `hd` parameter for hosted domain restriction

### Session Security (OWASP)
- **HttpOnly cookies**: Prevent JavaScript access (XSS protection)
- **Secure flag**: HTTPS only transmission
- **SameSite=Strict**: CSRF protection
- **Session rotation**: Regenerate on privilege escalation
- **Short timeout**: 15-30 minutes for low-risk apps
- **PostgreSQL session store**: Persistent, scalable storage

### Best Practices
- Never expose tokens to client-side JavaScript
- Implement rate limiting on auth endpoints
- Log authentication events for audit trail
- Use environment variables for secrets
- Implement CSRF protection
- Domain validation on server-side (don't trust `hd` param alone)

## Architecture

```
User → Google OAuth Login → Google Auth Server
                                    ↓
                            Verify @servicebay.ai domain
                                    ↓
                            Callback to Express server
                                    ↓
                            Create/Update User in PostgreSQL
                                    ↓
                            Create Session (PostgreSQL store)
                                    ↓
                            Set Secure Cookie
                                    ↓
                            Redirect to Dashboard
```

## Components

### 1. Passport Configuration
- Google OAuth 2.0 Strategy
- Serialization/Deserialization
- User profile handling
- Domain validation

### 2. Session Management
- PostgreSQL session store (connect-pg-simple)
- Secure cookie configuration
- Session rotation
- Cleanup old sessions

### 3. Middleware
- `isAuthenticated`: Check if user is logged in
- `isAdmin`: Check if user has admin role
- `isAdminOrOwner`: Check if user is admin or resource owner
- CSRF protection

### 4. Auth Routes
- `GET /auth/google`: Initiate OAuth flow
- `GET /auth/google/callback`: Handle OAuth callback
- `GET /auth/logout`: Destroy session
- `GET /auth/me`: Get current user
- `GET /auth/check`: Health check

## Security Measures

### 1. Cookie Security
```typescript
cookie: {
  httpOnly: true,         // No JavaScript access
  secure: true,           // HTTPS only (production)
  sameSite: 'strict',     // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

### 2. Domain Validation
```typescript
// In OAuth callback
if (!profile.emails[0].value.endsWith('@servicebay.ai')) {
  return done(new Error('Invalid domain'));
}
```

### 3. Rate Limiting
- 5 login attempts per 15 minutes per IP
- 10 requests per minute on auth endpoints

### 4. CSRF Protection
- Use `csurf` middleware
- Token in hidden form field
- Validate on all POST/PUT/DELETE requests

## Database Integration

### Session Table (automatic via connect-pg-simple)
```sql
CREATE TABLE session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON session(expire);
```

### User Table (from Prisma schema)
- Email (unique)
- Name
- Picture
- Role (ADMIN/MEMBER)
- IsActive

## API Endpoints

### Public Endpoints (No Auth)
```
GET  /auth/google                # Initiate OAuth
GET  /auth/google/callback       # OAuth callback
GET  /health                     # Health check
```

### Protected Endpoints (Auth Required)
```
GET  /auth/me                    # Current user info
POST /auth/logout                # Logout
GET  /api/*                      # All API routes
```

### Admin-Only Endpoints
```
POST   /api/users                # Create user
DELETE /api/users/:id            # Delete user
PUT    /api/users/:id/role       # Change role
POST   /api/sync/*               # Google Sheets sync
```

## Implementation Steps

1. Install dependencies
2. Configure Google OAuth credentials
3. Implement Passport strategy
4. Setup session store
5. Create auth middleware
6. Create auth routes
7. Add CSRF protection
8. Implement rate limiting
9. Add audit logging
10. Write tests

## Environment Variables

```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=random-secret-change-this
DATABASE_URL=postgresql://...
```

## Testing Strategy

### Unit Tests
- Passport strategy callback
- Middleware functions
- Domain validation logic
- Session serialization

### Integration Tests
- OAuth flow (mocked Google)
- Login/logout flow
- Protected route access
- Admin-only route access
- Invalid domain rejection
- Rate limiting

### E2E Tests
- Full login flow
- Logout flow
- Session persistence
- Session expiry

## Security Checklist

- [ ] HttpOnly cookies
- [ ] Secure flag (production)
- [ ] SameSite=Strict
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Domain validation (server-side)
- [ ] Session rotation on privilege change
- [ ] Audit logging
- [ ] Error messages don't leak info
- [ ] Secrets in environment variables
- [ ] HTTPS enforced (production)

## Error Handling

### Authentication Errors
- Invalid domain → Redirect with error message
- OAuth failure → Redirect with generic error
- Session expired → Redirect to login
- Unauthorized access → 401 response

### Security Errors
- Rate limit exceeded → 429 Too Many Requests
- CSRF token invalid → 403 Forbidden
- Invalid session → Clear cookie, 401 response

## Audit Logging

Log the following events:
- Successful login (user email, IP, timestamp)
- Failed login attempt (reason, IP, timestamp)
- Logout (user email, timestamp)
- Role change (admin, target user, new role, timestamp)
- Session expiry (user email, timestamp)

## Rollback Plan

- Keep old session data in database
- Can revert to backup session table
- Environment variables easy to change
- No database schema changes required

## Success Criteria

- ✅ Users can login with @servicebay.ai accounts
- ✅ Non-@servicebay.ai accounts are rejected
- ✅ Sessions persist across server restarts
- ✅ Admins can access admin-only routes
- ✅ Members cannot access admin routes
- ✅ CSRF protection works
- ✅ Rate limiting works
- ✅ All tests pass with >80% coverage
- ✅ Security audit passes
