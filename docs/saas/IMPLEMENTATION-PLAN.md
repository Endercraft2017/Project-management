# SaaS restructuring plan

Latest E-Z alignment: public root at ez.afkcube.com, official brand and actual-screen carousel; /login and /app retain app entry. Primary future auth is tenant code + email/password, adapting the reviewed ERP branch. Reuse its existing operator-console direction through product grants and an E-Z adapter, not direct SQLite/token transport. Philippines business/PH-US-UK-EU markets are confirmed. Follow EZ-TENANT-AND-LANDING-PLAN.md for the cross-repository contract, implementation order and live binding prerequisites. No new tenant authentication or console provisioning is enabled by the landing change.

Owner scope (2026-10-28): follow DECISIONS.md over historical defaults. Retain full collaboration/Gantt/report scope. Email/password and Google login stay; Drive/Sheets is excluded. AI is included with hard limits, optional at boot, and remote calls disabled without a usable free allowance/configured budget. Use Railway primary data plus encrypted bucket backups within the $0 pilot ceiling. Identified existing data is disposable; a clean schema may replace legacy backfill. Design/carousel work can run alongside Phase 0; customer/tenant enablement still requires all security gates.

Status: proposed implementation sequence; audit completed against `fb1a9c757e76d3414c8dbe66d888a9088c5ca2ce` on 2026-10-27. No product fixes are included in this audit change. Read [the audit](README.md), [architecture](TARGET-ARCHITECTURE.md), [design system](DESIGN-SYSTEM.md), and [owner decisions](DECISIONS.md) together.

## Delivery rules

Keep one ordered backlog with phase, task ID, owner, dependencies, acceptance evidence, reviewer, and release status. Finish each phase's exit gate before enabling its dependent behavior. Independent tasks inside a phase can run in parallel after their contracts are fixed. Do not translate the handbook into a requirement to buy every enterprise service before a pilot.

The lead agent owns architecture and integration, reviews every agent's diff and evidence, and assigns corrections. Agents own disjoint files or modules. Contracts, migrations, global tokens, and lockfiles have one writer at a time. A separate reviewer checks security and migration changes. Only after lead review and required tests pass may an agent commit and push a named feature branch. Never push directly to main, force-push, auto-merge, or deploy merely because an agent says it is done. Publish migrations and feature releases through protected CI. Existing user authorization covers reviewable feature-branch updates; production credentials, paid subscriptions, and destructive migration cutovers need their actual prerequisites resolved.

Every PR states the concrete behavior, affected contracts, tenant/permission implications, verification, migration/rollback, and remaining risks. Prefer small vertical slices over a simultaneous rewrite. Maintain a handoff with completed tasks, open defects, and pending decisions; an audit checkbox alone does not close a task.

## Phase 0 — Contain defects and establish executable evidence

Dependencies: none; independent of hosting, billing, and branding decisions.

- P0.1 Add focused regression tests for user-route/body ID confusion; task mention access; recipient-scoped task events; disabled-user sessions; unauthenticated and forbidden responses. Reproduce failures before changing behavior. Use only synthetic users and a disposable test database.
- P0.2 Fix ownership checks to authorize the exact validated resource ID used by the handler. Remove the caller-controlled mention bypass; resolve permissions from server-side data. Restrict realtime payloads to authorized recipients, with denied-access regression tests.
- P0.2a Revoke existing sockets on logout, user deactivation and conversation removal; reauthorize sensitive events. Test an already-connected client, not only a new handshake.
- P0.3 Make optional Google, Drive, OpenAI, and email adapters lazy and explicitly enabled. The app must start without paid/external credentials. Disabled capabilities return a stable unavailable response; they must not silently succeed or fabricate results. This is not an authentication bypass: unauthenticated protected routes still return 401.
- P0.4 Restore real CI: pull-request frozen installation, typecheck, lint, builds, real tests, vulnerability/secret/static scans; block deployment on failed checks. Build once and deploy the exact validated commit/artifact digest; require named status checks, review, least-privilege deploy secrets, serialized releases and no alternate unchecked automatic deployment path. Verify actual GitHub/hosting rules and plan eligibility. Repair missing ESLint configuration and the real lint error; classify warnings rather than blanket-disabling rules.
- P0.5 Triage current dependency advisories by affected version, runtime reachability, exploit conditions, fix and regression risk. Update deliberately; do not use `npm audit fix --force` as a substitute for review. Keep TLS/checksum verification.
- P0.6 Correct false-success SMTP behavior; stop logging invitation URLs, credentials, or email bodies. Keep test mail local. Verify OAuth state and PKCE support, exact callback/redirect handling, mounted per-identity/IP auth throttles, and cookie-write CSRF/origin defenses. Test missing/mismatched state, unsolicited callbacks, same-site sibling origins and form-encoded writes; handle intended OAuth callbacks/webhooks deliberately.
- P0.7 Escape untrusted names and generated text in email templates. Fail closed when an enabled connector lacks a valid encryption key; inventory and re-encrypt legacy plaintext tokens with key versioning and rotation tests. Correct Google callback configuration to the actual `/api/auth/google/callback` route.

Exit: no open confirmed high-risk authorization bypasses; targeted security tests genuinely exercise the boundary; CI is required before main deployment; builds and supported checks pass; startup with integrations disabled is verified. Open critical/high advisories require a documented, reviewed reachability decision or remediation before release.

## Phase 1 — Freeze contracts and global foundations

Depends on Phase 0. Workstreams: architecture/contracts; design system; test harness. They share a signed-off contract before feature work.

- P1.1 Record architecture decisions: workspace/project visibility, role matrix, tenant data placement and ownership rules. Define provider-independent identity/hosting interfaces and a preliminary topology/region shortlist; final identity/provider selection is required before Phase 4, and actual deployment/region approval before the pilot. Capture an API module map. Do not block shared UI/contracts on an unresolved vendor preference.
- P1.2 Populate the shared workspace with runtime Zod request/response/event schemas and inferred types, or generate clients from one OpenAPI contract. Choose one source of truth. Standardize pagination, validation errors, UTC timestamps, cursor semantics, idempotency and request IDs. Fix progress-filter field drift.
- P1.3 Implement the common UI primitives and tokens described in DESIGN-SYSTEM.md with stories, keyboard and contrast checks. Design the workspace shell, URL routes, loading/error/empty states and responsive behavior before rebuilding screens.
- P1.3a Add app-level and feature/route React ErrorBoundary components, distinct from Suspense loading fallbacks. Test thrown renders and failed lazy chunks with reload/retry. Distinguish current-user 401 from offline/timeout/500 and show retry instead of false sign-in.
- P1.4 Add disposable database fixtures, two-tenant test factories, unit/integration/e2e separation, axe accessibility checks, visual baselines, and static/secret scans. Remove vacuous assertions by replacing them with behavior checks.

Exit: contract and component examples are reviewed; backend and client consume the same schemas; one representative vertical slice demonstrates consistent errors, permissions, UI states and accessible interactions. UI foundations can proceed while data migration is being prepared, but cannot ship tenant features early.

## Phase 2 — Tenant schema and safe legacy migration

Depends on Phase 1 and the owner's legacy-data decision. No destructive reset of existing data.

- P2.1 Add Workspace, Membership, Project, project visibility/membership if required, workspace-scoped invitations, integration connections, audit records and entitlement skeletons. Keep users as global identities; move business roles to memberships. Separate platform operators from tenant administrators.
- P2.2 Inventory every existing table, foreign key, unique key, file, job and event. Define ownership for all of them, including notes, daily updates, summaries, settings and conversations. Workspace scope must apply to the less visible modules too.
- P2.3 Expand schema additively; map legacy records into one explicit legacy workspace only after validating the actual existing data ownership. Backfill tenant keys in bounded, restartable batches with counts and orphan checks. Do not create an arbitrary tenant from a client header or email domain.
- P2.3a Before final backfill validation/NOT NULL, deploy a legacy-compatible writer that populates tenant/project keys on every new record, or pause writes for the controlled migration. Reconcile again after that boundary; an old writer must not reintroduce null/unowned rows. Keep public workspace creation disabled until Phase 3 passes.
- P2.4 Add tenant-leading indexes and compound constraints/FKs that prevent cross-tenant references. Resolve the backlog's nullable sprint mismatch; enforce progress/nesting invariants at the appropriate database and domain layers; prevent task hierarchy cycles and inconsistent descendants. Validate existing rows before adding constraints.
- P2.5 Use an expand/backfill/validate/enforce/contract sequence with a maintenance or write-pause strategy. Prove restore on a copy before touching production. Keep old columns while the old deployment must remain rollback-compatible; remove them in a later release only.
- P2.6 Never deploy the old unscoped application after a second tenant has data. Roll forward or disable the affected capability; a whole-state restore requires an explicit recovery/data-loss decision.

Exit: full ownership inventory reconciles; repeatable migration passes with representative legacy fixtures; no null/orphan/wrong-tenant rows; restore rehearsal and cutover runbook are reviewed. `prisma migrate resolve --rolled-back` is bookkeeping, not a schema undo.

## Phase 3 — Enforce isolation everywhere

Depends on Phase 2. Use one security contract across HTTP, jobs, realtime, integrations and files.

- P3.1 Resolve authenticated identity + workspace membership server-side for each request. Use scoped repositories requiring TenantContext; deny missing context. No unscoped Prisma imports in feature modules. Resource ownership and role policies must match the actual query and write.
- P3.2 Where selected, enforce PostgreSQL RLS with a non-owner, non-BYPASSRLS application role and transaction-local tenant context; use a separate migration role. Test pool reuse and failed/aborted transactions. RLS supplements service policies; do not claim it works merely because SQL policies exist.
- P3.3 Scope Socket.IO rooms and event payloads to workspace and resource permissions; revalidate membership on joins and revoke access on removal. Add cross-tenant, cross-project, removed-member and reconnect tests. Fix shared client socket cleanup so one screen cannot remove another screen's listeners.
- P3.4 Scope uploads, object keys, signed URLs, exports/imports, notifications, audit logs, integrations, background work and rate limits. Tenant ID in a job payload is insufficient without an authorized job creation path and worker policy.
- P3.5 Scope query caches, persisted state and realtime updates by workspace. Cancel/clear old requests and cache on workspace switch/sign-out. Verify that late responses cannot render another workspace's data.
- P3.5a Test two tabs in different workspaces for the same user; a mutable session-wide current-workspace value must not retarget requests. Each request carries an explicit selector that is reauthorized server-side.

Exit: two tenants with multiple roles cannot access one another's records by changing IDs in path/query/body, event joins, downloads, caches or queued work. Test public IDs, composite FK violations, role changes, reconnects, and direct database reads under the application role. This is the SaaS launch blocker.

## Phase 4 — Customer identity and workspace lifecycle

Depends on Phase 3 and the identity-provider decision.

- P4.1 Deliver sign-up, verification/recovery as supported by the provider, sign-in/out, session expiry/revocation, and clear failure states. Remove the hardcoded company-domain gate. Keep account linking based on verified provider identities, never on unverified email alone.
- P4.2 Add workspace creation/switching, invitations with hashed tokens at rest and verified intended identity at acceptance, role changes, invitation expiry/replay prevention, owner transfer and safeguards against deleting the last owner. Define what happens to subscriptions/data when owners or members leave.
- P4.2a Let existing verified identities join a second workspace without creating another global account. Atomically consume the pending invite and create membership/seat reservation; test concurrent acceptance/revocation, wrong-account, expiry and replay. Retire global-role invitation paths and revoke/reissue legacy pending invitations under the migration policy. Preserve IDs and require verified reauthentication for identity linking; never merge accounts from unverified email.
- P4.3 Implement email/password plus basic Google sign-in with verified linking. One platform Google client serves ordinary tenants. Remove Drive/Sheets consent and connector surfaces from the selected product; revoke unused grants safely. Login needs identity scopes only.
- P4.4 Add onboarding: create workspace → create first project → invite team → create/complete first task. Provide usable defaults without automatically importing or sending customer data.

Exit: a new customer outside the original company can reach the first useful task; a user can join two workspaces safely; role change/revocation is enforced across active sessions and sockets. Credentials are configured through secure settings.

## Phase 5 — Rebuild the product UI as consistent vertical slices

Depends on Phases 1 and 4. Reuse shared primitives; no separate designs per agent.

- P5.1 Ship workspace shell, project navigation, dashboard and accessible account/workspace menus with durable routes and browser history.
- P5.2 Migrate project/task/sprint flows, including backlog, hierarchy, filters, list/detail editing and optimistic rollback. Use shared validation and test all loading/empty/error/permission states.
- P5.2a Make task search, range filters, pagination and counts server-driven and contract-tested beyond the current first-1000-item client subset. Preserve filter state in URLs and test later pages and empty filtered results.
- P5.3 Migrate chat, notifications, notes and updates only if retained in the agreed MVP. Use common drawers/dialogs/forms, recipient-safe realtime, cursor pagination and upload states.
- P5.3a Replace reaction JSON read/overwrite with atomic normalized reactions or a tested locked update. Add version/precondition checks and explicit conflict handling to task edits/shared settings; test concurrent editors and reactions.
- P5.3b Test send/edit acknowledgement failures: preserve message text and attachments until acknowledged, show retry in context, and use stable client idempotency keys so retries do not duplicate messages.
- P5.4 Migrate reports/Gantt only after core workflows work; provide equivalent readable task information when the chart is inaccessible. Render dates consistently in the selected workspace/user timezone.
- P5.5 Add workspace settings for members, integrations, plan/usage, data export/deletion and notification preferences. Make unavailable features honest and understandable.

Exit: all retained screens use global tokens/components; reviewed desktop/mobile/light/dark visual baselines; keyboard-only completion of core workflows; WCAG 2.2 AA checks plus manual focus/screen-reader testing; no cross-workspace stale state. Do not claim accessibility certification from axe alone.

## Phase 6 — Durable work and integrations

Depends on Phase 3; screen integration follows Phase 5.

- P6.1 Move cron/slow side effects to durable jobs with atomic claims, bounded concurrency, retries/backoff, idempotency, dead-letter inspection and tenant context. Use a transactional outbox for effects coupled to database writes. Avoid an extra queue service until measurements justify it.
- P6.2 Make email delivery observable and retryable; never mark invites delivered on a mock response. Configure sender DNS/verification, unsubscribe and suppression as applicable. Test with a local mailbox or provider sandbox before real sends.
- P6.3 Put uploads in private object storage. Authorize upload intent before allocating/writing bytes; enforce quotas and size limits, sniff actual content rather than trust supplied MIME/extension, and clean up failed writes. Authorize signed URL issuance; define retention and quarantine/scanning as needed. Ensure URLs cannot bypass membership revocation indefinitely.
- P6.3a Make imports preview→validate→confirm idempotent batches with stable source keys, per-row status, retry and compensation. A partial import retried by the browser cannot duplicate previously committed rows. Clean up failed uploads and external sharing side effects.
- P6.4 Deliver AI with atomic per-workspace spend/token/concurrency reservations, hard quotas and cost visibility. Keep execution disabled until a usable free allowance/provider and explicit numeric limits are configured, preserving the $0 pilot ceiling. Validate disclosures/output quality and never overwrite valid summaries with fallback/partial generation. Drive/Sheets integrations are excluded from the chosen scope.

Exit: duplicate jobs and retries do not duplicate external effects; two app replicas do not double-send scheduled work; retries recover after upstream failure; disconnecting an integration revokes access; costs and usage are attributed to the workspace.

## Phase 7 — Billing and commercial controls

Depends on Phases 3–4 and seller-country/plan decisions. It can run alongside Phase 5 after contracts stabilize; billing webhooks and enablement also require the durable receipt/outbox/job foundation in P6.1. Enable it only after the core customer flow works.

- P7.1 Implement workspace-owned subscriptions, plan versions, entitlements, seats/storage/AI usage counters and server-side enforcement. A hidden upgrade button is not an entitlement check.
- P7.2 Integrate a supported payment provider using hosted checkout/portal. Verify webhook signatures on raw bodies; deduplicate event IDs; handle retries, reordering and reconciliation. Never grant paid access from a checkout redirect or client-supplied price.
- P7.3 Define trials, cancellation, grace periods, failed payments, seat adjustments, refunds, tax responsibilities and downgrade behavior. Preserve data on downgrade according to policy; do not immediately delete customer content.
- P7.4 Test checkout→webhook→entitlement, upgrade/downgrade, duplicate/out-of-order webhook, late payment recovery, tenant mixups and cancellation. Only test mode until explicitly configured for live trading.

Exit: billing state and access reconcile after retries and event reordering; quotas are atomic; provider eligibility and tax/refund ownership are confirmed. Payment services charge transaction fees even if development has no monthly charge.

## Phase 8 — Operations, privacy and pilot release

Depends on all enabled product capabilities. Build these controls during earlier phases; this is their final verification gate.

- P8.1 Separate local/staging/production identities, databases, storage, secrets and webhooks. Pin toolchains, frozen installs and deployment actions. Run one migration job before compatible app rollout.
- P8.2 Implement liveness/readiness, structured redacted logs/request IDs, error tracking, actionable alerts, uptime checks, dependency patch cadence and an incident runbook. Measure representative latency/error/queue lag with synthetic staging data.
- P8.3 Set and rehearse backup retention, restore/RPO/RTO, account recovery, tenant export/deletion, file deletion and key rotation. Confirm provider plan capabilities rather than assuming backups exist on free tiers.
- P8.4 Prepare terms, privacy notice, vendor/subprocessor disclosure, retention rules, support contact, security reporting and jurisdiction-specific obligations. Obtain qualified legal guidance where needed; no code audit can certify legal compliance.
- P8.5 Test failure/retry/empty/offline states, browser/device support, accessibility and permission boundaries with independent users. Run authorized staging DAST and a bounded load test only after functional correctness. Review all remaining critical/high findings and rollback readiness before inviting paying users.

Exit: limited pilot checklist signed off with evidence, costs and operational owner; success metrics defined (first project/task, invite accepted, retention); support and incident procedures usable. Expand to paid/public availability only after pilot evidence and a re-audit.

## Definition of done for the overhaul

A customer can sign up, create or join a workspace, create a project, collaborate according to their role, and manage their account and plan; isolated tenants remain isolated across every data path; optional integrations can be absent or fail without taking the core down; UI behavior follows one design system; the release pipeline, restore procedure, support process and actual operating budget have been exercised. No claim of being production-ready follows from a build or a clean-looking screen alone.
