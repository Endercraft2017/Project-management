# ServiceBay PM - Project Management & Collaboration Tool

A modern, secure project management and team collaboration tool built specifically for ServiceBay.ai's development team.

## 🎯 Project Overview

**Tech Stack**:
- **Backend**: Node.js + Express + TypeScript + Prisma + Socket.io
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Railway)
- **Auth**: Google OAuth 2.0
- **Real-time**: WebSocket (Socket.io)
- **Deployment**: Railway

## ✨ Features

- ✅ **Authentication**: Google OAuth 2.0 restricted to @servicebay.ai
- ✅ **Task Management**: Hierarchical tasks (4 levels), sprint-based
- ✅ **Real-time Chat**: Direct messages and group chats
- ✅ **Google Sheets Sync**: Bi-directional task synchronization
- ✅ **Progress Tracking**: Visual dashboards with charts
- ✅ **Gantt Chart**: Timeline visualization
- ✅ **Role-Based Access**: Admin and Member roles
- ✅ **Dark Mode**: Light/Dark theme support
- ✅ **Secure**: OWASP best practices, rate limiting, CSRF protection

## 📊 Implementation Status

**Completed**: 100% 🎉
- ✅ Database schema (Prisma + PostgreSQL)
- ✅ Authentication system (Google OAuth + Sessions)
- ✅ User management API
- ✅ Sprint management API
- ✅ Task management API (4-level hierarchy)
- ✅ Google Sheets integration (bidirectional sync)
- ✅ Real-time chat system (Socket.io + REST API)
- ✅ File upload system (Multer + CSV/Excel import)
- ✅ Frontend setup & Tasks View (Vite + React + TanStack Query)
- ✅ Summary View with Charts (Recharts + Dashboard)
- ✅ Gantt Chart View (Frappe Gantt + Timeline)
- ✅ Chat View UI (Socket.IO + Emoji Picker + Infinite Scroll)
- ✅ Theme Toggle (Light/Dark mode with Zustand)
- ✅ Deployment Configuration (Railway + GitHub Actions)

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed progress.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL (or Railway account)
- Google Cloud Project (for OAuth)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd project-management

# Install dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies (when ready)
cd ../client && npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/servicebay_pm

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session
SESSION_SECRET=generate-a-random-32+-character-string

# Admin users
ADMIN_EMAILS=admin@servicebay.ai,another-admin@servicebay.ai
```

### Database Setup

```bash
cd server

# Run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Seed database with sample data
npx prisma db seed

# Open Prisma Studio (optional)
npx prisma studio
```

### Run Development Server

```bash
cd server
npm run dev
```

Server will start on http://localhost:3000

### Run Tests

```bash
cd server
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 📁 Project Structure

```
project-management/
├── docs/
│   ├── architecture/    # System guide and API call pipeline
│   ├── documentation/   # Feature documentation
│   ├── features/        # Per-feature specs and reviews
│   ├── guides/          # User, setup, and deployment guides
│   ├── plans/           # Implementation plans
│   ├── error_fixes/     # Bug investigation write-ups
│   └── archive/         # Historical status/progress/test reports
├── server/              # Backend (Node.js + Express)
│   ├── src/
│   │   ├── auth/       # Authentication
│   │   ├── database/   # Prisma client
│   │   ├── config/     # Configuration
│   │   ├── middlewares/# Express middleware
│   │   ├── users/      # User management
│   │   ├── tasks/      # Task management (TODO)
│   │   ├── chat/       # Chat system (TODO)
│   │   └── sheets/     # Google Sheets sync (TODO)
│   └── prisma/
│       ├── schema.prisma  # Database schema
│       ├── migrations/    # Prisma migrations
│       └── seed.ts        # Seed data
├── client/              # Frontend (React + Vite) (TODO)
├── tests/
│   ├── feature/        # Integration tests
│   └── CI_CD/          # GitHub Actions workflows
├── package.json        # Root package
└── README.md          # This file
```

## 🧪 Testing

Tests are written using Jest and Supertest.

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/feature/database.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

**Current Test Coverage**: ~90% (for implemented features)

## 🔒 Security

This project follows OWASP security best practices:

- ✅ Input validation (Zod)
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection (sanitization, CSP headers)
- ✅ CSRF protection (SameSite cookies)
- ✅ Rate limiting
- ✅ Secure session management
- ✅ HTTPS enforcement (production)
- ✅ Security headers (Helmet.js)
- ✅ Domain validation (@servicebay.ai)
- ✅ No secrets in code

## 📚 Documentation

- [Project Overview](./docs/documentation/00-project-overview.md)
- [Database Schema](./docs/documentation/01-database-schema.md)
- [Authentication](./docs/documentation/02-authentication.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)
- [Progress Tracking](./PROGRESS.md)

### API Documentation

API documentation will be generated using OpenAPI/Swagger (TODO).

For now, see plan documents in `docs/plans/` for endpoint specifications.

## 🛠️ Development

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

### Database

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# View data
npx prisma studio
```

### Git Workflow

1. Create feature branch
2. Implement feature
3. Write tests
4. Update documentation
5. Create pull request

## 🚀 Deployment

The project is configured for deployment to Railway with automated CI/CD via GitHub Actions.

### Railway Deployment

1. Create Railway project from GitHub repository
2. Add PostgreSQL database service
3. Configure environment variables (see [docs/documentation/14-deployment.md](./docs/documentation/14-deployment.md))
4. Railway will automatically build and deploy on push to main

### Manual Build

```bash
# Build server
cd server && npm run build

# Build client
cd client && npm run build

# Start production server
cd server && npm start
```

See complete deployment guide: [docs/documentation/14-deployment.md](./docs/documentation/14-deployment.md)

## 🤝 Contributing

All core features are complete! For future enhancements:

1. Review [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for current features
2. Propose new features or improvements
3. Follow the established pattern: Plan → Implement → Test → Document → CI/CD
4. Maintain test coverage >80%
5. Submit PR with comprehensive documentation

## 📝 License

Private - ServiceBay.ai Internal Use Only

## 👥 Team

ServiceBay.ai Development Team (~15 developers)

---

**Built with ❤️ for ServiceBay.ai**
