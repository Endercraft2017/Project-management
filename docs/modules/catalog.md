# Module Catalog

Inventory of the capabilities that exist in the code today. Created 2026-09-26
from the server route mounts (`server/src/app.ts`) and the client views.

Status labels: `planned`, `partial`, `working`, `reusable`. Server modules are
marked `partial` until their tests have been run in this project: server
dependencies were not installed when this inventory was taken, so
`npm test --workspace=server` could not run.

## Business modules (server + client view)

| Module | Responsibility | Server | API | Client | Status |
|---|---|---|---|---|---|
| Auth | Google OAuth sign-in, sessions, auth middleware | `server/src/auth`, `middlewares/session.ts` | `/api/auth` | `layout/AuthScreens.tsx` | partial |
| Users | Team members and roles (ADMIN / MEMBER) | `server/src/users` | `/api/users` | `users/UsersList.tsx` | partial |
| Invites | Invite members by email, accept via token | `server/src/invites` | `/api/invites` | `invites/*`, `pages/AcceptInvitePage.tsx` | partial |
| Sprints | Sprint lifecycle | `server/src/sprints` | `/api/sprints` | used by tasks and gantt | partial |
| Tasks | Task hierarchy, assignment, progress, statistics | `server/src/tasks` | `/api/tasks` | `tasks/*`, `gantt/*`, `summary/*` | partial |
| Task import | CSV/XLSX task import | `server/src/upload` | `/api/upload` | `tasks/TaskImport.tsx` | partial |
| Sheets sync | Two-way Google Sheets sync with conflict resolution | `server/src/sync` | `/api/sync` | `sync/ConflictResolutionModal.tsx` | partial |
| Chat | Conversations, threads, mentions, reactions, notifications, Socket.IO | `server/src/chat` | `/api/conversations` | `chat/*` | partial |
| Drive files | Google Drive attachments | `server/src/drive`, `services/*drive*` | `/api/drive` | `chat/attachments/*`, `hooks/useGooglePicker.ts` | partial |
| Daily updates | Per-day member updates, late updates | `server/src/updates` | `/api/updates` | `updates/*` | partial |
| Notes | Personal notes with scheduled reminders | `server/src/notes` | `/api/notes` | `notes/NotesView.tsx` | partial |
| Weekly summaries | OpenAI-generated weekly recaps, email delivery | `server/src/summaries`, `services/openai.service.ts` | `/api/summaries` | `summaries/*` | partial |
| Admin | Missing-update detection, reminder scheduling, settings | `server/src/admin` | `/api/admin` | `admin/*` | partial |

## Shared (not business modules)

| Area | Responsibility | Location | Status |
|---|---|---|---|
| App shell | Navigation, layout, theme, glass design system, auth screens | `client/src/App.tsx`, `client/src/components/layout/*`, `client/src/index.css`, `client/src/store/*` | working (`client/src/App.test.tsx`, 14 tests) |
| UI primitives | Shared button, toast | `client/src/components/ui`, `components/common` | working |
| Email | Nodemailer transport and helpers | `server/src/lib/email*.ts` | partial |
| Security | Helmet CSP, rate limits | `server/src/middlewares/security.ts` | partial |

## Known connections

- Chat -> clients: Socket.IO events (`new_message`, `task_*`, `update_reminder`,
  `reminder_notification`, `member_daily_update`); the app shell listens and
  invalidates React Query caches.
- Admin -> Daily updates: the missing-updates scheduler reads updates and sends
  `update_reminder` notifications; the shell routes them to the Daily updates view.
- Weekly summaries -> Tasks and Daily updates: summaries are built from both.
- Invites -> Users: accepting an invite creates or activates a user.
