# Project Overview - ServiceBay PM

## Introduction

ServiceBay PM is a comprehensive project management and team collaboration tool built specifically for the ServiceBay.ai development team. It combines task management, real-time chat, and Google Sheets integration in a modern, secure web application.

## Architecture

### Tech Stack

- **Language**: TypeScript (Full-stack)
- **Backend**: Node.js v20+ with Express.js
- **Frontend**: React 18+ with Vite
- **Database**: PostgreSQL (Railway)
- **ORM**: Prisma
- **Real-time**: Socket.io (WebSocket)
- **Authentication**: Google OAuth 2.0
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts + Frappe Gantt

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React)                      │
│                                                         │
│  ┌─────────┬─────────┬──────────┬────────┬──────────┐ │
│  │  Tasks  │ Summary │  Gantt   │  Chat  │  Theme   │ │
│  └─────────┴─────────┴──────────┴────────┴──────────┘ │
│                                                         │
│  HTTP/REST API          WebSocket (Socket.io)          │
└─────────────┬──────────────────────┬───────────────────┘
              │                      │
              ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│             Server (Express + TypeScript)               │
│                                                         │
│  ┌──────────┬────────────┬──────────┬────────────────┐ │
│  │   Auth   │   Tasks    │   Chat   │  Google Sheets│ │
│  │  (OAuth) │  (CRUD)    │(Socket.io)│   (Sync)     │ │
│  └──────────┴────────────┴──────────┴────────────────┘ │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Prisma ORM)           │
│                                                         │
│  Users │ Tasks │ Sprints │ Conversations │ Messages    │
└─────────────────────────────────────────────────────────┘
              │
              ▼ (Manual Sync)
┌─────────────────────────────────────────────────────────┐
│                   Google Sheets                         │
│         (Task data only - external view/edit)          │
└─────────────────────────────────────────────────────────┘
```

## Core Features

### 1. Authentication & Authorization
- Google OAuth 2.0 restricted to @servicebay.ai domain
- Role-based access control (Admin, Member)
- Persistent sessions with PostgreSQL

### 2. Task Management
- Hierarchical task structure (4 levels max)
- Sprint-based organization
- Progress tracking (percentage)
- Start dates and deadlines
- CSV/Excel import
- Google Sheets bi-directional sync

### 3. Real-time Chat
- Direct messaging (1-on-1)
- Group chats with member management
- Message reactions and emojis
- File attachments
- Typing indicators
- Online/offline status

### 4. Data Visualization
- Task tree view with hierarchical display
- Progress bar charts by sprint
- Gantt chart timeline
- Summary dashboard

### 5. UI/UX
- Modern, clean interface
- Light/Dark theme toggle
- Responsive design
- Accessible components (shadcn/ui)

## Security Features

### OWASP Top 10 Compliance

1. **Injection Prevention**
   - Prisma ORM (parameterized queries)
   - Input validation with Zod
   - Output sanitization

2. **Broken Authentication**
   - Google OAuth 2.0
   - Secure session management
   - HttpOnly cookies

3. **Sensitive Data Exposure**
   - HTTPS only (Railway SSL)
   - Environment variables for secrets
   - No secrets in client code

4. **XML External Entities (XXE)**
   - JSON-only API
   - No XML processing

5. **Broken Access Control**
   - Role-based permissions
   - Owner-based access checks
   - Admin-only endpoints

6. **Security Misconfiguration**
   - Helmet.js security headers
   - CORS policy enforcement
   - Error handling without stack traces

7. **Cross-Site Scripting (XSS)**
   - React auto-escaping
   - DOMPurify for user content
   - CSP headers

8. **Insecure Deserialization**
   - Type validation with Zod
   - No eval() or Function()
   - Safe JSON parsing

9. **Using Components with Known Vulnerabilities**
   - npm audit on CI/CD
   - Dependabot auto-updates
   - Regular dependency review

10. **Insufficient Logging & Monitoring**
    - Structured logging (Winston)
    - Error tracking
    - Audit logs for sensitive operations

## Data Flow

### Task Management Flow
```
User Action → Express API → Validation (Zod) → Prisma ORM → PostgreSQL
                                                              ↓
                                                    (Manual Sync Button)
                                                              ↓
                                                        Google Sheets
```

### Chat Flow
```
User Message → Socket.io Client → WebSocket → Server Validation
                                                      ↓
                                              Save to PostgreSQL
                                                      ↓
                                          Broadcast to Room Members
```

### Authentication Flow
```
User → Google OAuth Login → Verify @servicebay.ai domain
                                    ↓
                            Create/Update User in DB
                                    ↓
                            Create Session (PostgreSQL)
                                    ↓
                            Return Session Cookie
```

## Deployment

### Platform
- **Railway**: Single service deployment
- **PostgreSQL**: Railway-managed database
- **Static Assets**: Served from Express

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth secret
- `SESSION_SECRET`: Session encryption key
- `GOOGLE_SHEETS_*`: Service account credentials
- `ADMIN_EMAILS`: Comma-separated admin emails

## Performance Considerations

### For 15 Users
- In-memory caching (not needed, direct DB queries)
- PostgreSQL connection pooling (Prisma)
- WebSocket for real-time (no polling)
- Code splitting (React lazy loading)
- Optimistic UI updates

### Scalability
- PostgreSQL can handle 100+ concurrent users
- Socket.io scales with Redis adapter (future)
- Railway can scale vertically
- Stateless API (horizontal scaling ready)

## Development Workflow

1. **Feature Branch**: Create from `main`
2. **Documentation**: Update feature docs
3. **Implementation**: Write code with tests
4. **Testing**: Unit + Integration tests
5. **CI/CD**: Automated tests run
6. **Code Review**: PR review process
7. **Deploy**: Merge to `main` → Auto-deploy

## Testing Strategy

- **Unit Tests**: Jest for business logic
- **Integration Tests**: API endpoints
- **E2E Tests**: Playwright for user flows
- **WebSocket Tests**: Socket.io testing utilities
- **Coverage**: >80% target

## Monitoring

- Railway built-in metrics
- Application logs (Winston)
- Error tracking (optional Sentry)
- Database query monitoring (Prisma)

## Support & Documentation

- API documentation (OpenAPI/Swagger)
- Component documentation (Storybook - optional)
- User guide (Markdown docs)
- Developer onboarding guide
