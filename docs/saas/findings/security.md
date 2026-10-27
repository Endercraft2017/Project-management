# Security and SaaS isolation audit

Audited source HEAD `fb1a9c757e76d3414c8dbe66d888a9088c5ca2ce` on 2026-10-27. Scope: authentication, HTTP and Socket.IO authorization, tenant readiness, uploads, secrets handling, third-party integrations, privacy controls, and the supplied handbook chapters 4–12 and 23. The handbook is a checklist reference, not verified authority for legal or vendor claims. Findings below distinguish source proofs from end-to-end verification. No production calls, destructive operations, secrets extraction, source modifications, commits, or pushes were performed by this reviewer.

Current architecture is a **single organization internal application**, not a multi-tenant SaaS. There is no tenant model today; therefore the missing tenant boundary is a SaaS launch blocker, not evidence that an existing multi-tenant deployment has been exploited. The current code nevertheless contains confirmed cross-user authorization defects.

## Release blockers and confirmed defects

### SEC-01 — High: client-selected mention mode bypasses task read permissions

- Checks: AUTHZ-01, AUTHZ-02, AUTHZ-04; AUDIT-02 crossreference.
- Evidence: `server/src/tasks/controller.ts:64` reads `req.query.viewMode`; lines 84–88 grant permission when it equals `mention`, without proving the task was mentioned or that the requester belongs to a conversation. `server/src/tasks/service.ts:155` selects the task by ID before this decision.
- Failure: an authenticated member who knows another user's task UUID requests `GET /api/tasks/<other-task>?viewMode=mention` and receives the task. Global task broadcasts also expose task UUIDs (SEC-03). This defeats the assigned-to/created-by rule enforced for normal task reads.
- Fix: remove the caller-controlled exception. Authorize task access through a central resource policy; if sharing through chat is a requirement, persist an explicit share or mention record and require membership of its conversation and tenant. Apply the same policy to nested tasks, parent inclusion, sprint task views, exports, statistics, and events.
- Verification: complete source path reviewed; authenticated HTTP reproduction was not run because real OAuth credentials are unavailable.

### SEC-02 — High: user owner middleware authorizes a different ID from the handler

- Checks: AUTHZ-02, API-02.
- Evidence: `server/src/users/routes.ts:26` and `:35` declare `/:id`, but `server/src/auth/middleware.ts:85` authorizes `req.params.userId || req.body.userId`. The controller at `server/src/users/controller.ts:85` parses `req.params.id`; the schema at `server/src/users/validators.ts:27` accepts `name` and strips unknown keys; the service at `server/src/users/service.ts:149` updates the handler's ID.
- Failure: nonadmin A sends `PATCH /api/users/<B-id>` with JSON `{ "userId": "<A-id>", "name": "Changed by A" }`. Middleware authorizes the body identity and the handler changes B's name. A raw HTTP client can also supply a JSON body to GET to pass this middleware, although ordinary browser GET APIs do not permit bodies. Ordinary owner requests without that body are incorrectly rejected.
- Fix: resolve a validated route resource ID once, compare that same ID with the actor or current permissions, forbid body identity selectors, reject unknown input keys, and test both rejection and legitimate self-service. No role-change bypass was identified in this path; the profile schema only permits a name.
- Verification: root independently ran a synthetic real-middleware/schema probe (`authorization-probe.cjs`) proving the mismatched-ID authorization decision and field stripping. No real HTTP request or database change was made.

### SEC-03 — High: task events disclose private task data to every authenticated socket

- Checks: AUTHZ-05, AUTHZ-11.
- Evidence: `server/src/tasks/service.ts:39` restricts ordinary task listings to creator/assignee, but `:335` calls `io.emit('task_created', task)` and `:357` globally emits even intended admin notifications. Further creation/update paths at `:465` also broadcast full task objects. Socket rooms for conversation messages exist, showing a usable pattern, but these task events bypass them.
- Failure: member A connects normally and listens for task events while B creates a task that A cannot list through the REST policy. A receives task details and identifiers. Encoding an adminId in a globally delivered payload does not restrict its audience.
- Fix: publish only to server-computed authorized user/project rooms; include workspace in room names; centralize event authorization, minimize DTOs, and test with two users/two tenants. UI filtering cannot repair disclosure.
- Verification: source review; no live socket reproduction.

### SEC-04 — High: existing sockets survive logout, deactivation, and conversation removal

- Checks: AUTH-04, AUTH-07, AUTHZ-05.
- Evidence: `server/src/chat/socket-middleware.ts:28` validates session and active user only at handshake; `server/src/chat/socket-handlers.ts:41` closes over userId and `:88` joins a conversation room. `server/src/auth/routes.ts:75` destroys the HTTP session but does not disconnect sockets. `server/src/chat/conversation-service.ts:672` deletes membership without evicting room members. REST/chat services continue to publish to that room (e.g. `server/src/chat/controller.ts:475`).
- Failure: a user removed from a group leaves the socket open and continues receiving future room broadcasts. A deactivated user similarly retains a connection; individual services recheck some memberships but no event-wide session/active-status guard is present.
- Fix: session/user/membership revocation version; disconnect associated sockets and remove room memberships on revocation; reauthorize sensitive socket events and resubscriptions; integration tests covering an already connected client.
- Verification: source review. This is not a claim that HTTP session destruction itself is absent.

### SEC-05 — High: OAuth lacks verified state/PKCE and forces broad Drive consent on every login

- Checks: AUTH-11, AUTH-12, API-01.
- Evidence: `server/src/auth/passport-config.ts:34` configures the Google OAuth2 strategy without state store or PKCE; `server/src/auth/routes.ts:23` starts login without these protections. Both request `drive.readonly` and `drive.file`; the route forces consent and hardcodes `hd=servicebay.ai` (`:30`). `server/src/lib/email-utils.ts:40` and passport `:67` reject other domains. `server/src/middlewares/security.ts:122` defines authLimiter but source search finds no mount; `/api` receives only the general limiter.
- Failure: unsolicited OAuth callbacks are not bound to the initiating browser's state; login-CSRF/account-confusion protections are missing. Ordinary SaaS users outside the internal domain cannot onboard, and users must grant Drive read access even if they only want project management. External Google sign-in/Drive scope verification is not dynamically tested.
- Fix: use a maintained authentication solution with secure OAuth/OIDC state and PKCE support. Separate platform identity from optional Google Drive/Sheets connectors. Default login to basic identity scopes and request connector scopes incrementally. Review Google restricted-scope verification requirements before selecting `drive.readonly`. Keep one product-level OAuth application by default; individual tenants do not need to supply developer credentials.

### SEC-06 — High conditional: CSRF middleware is never mounted

- Checks: WEB-02.
- Evidence: `server/src/middlewares/security.ts:143` exports csrfProtection, but `server/src/app.ts:12` imports only headers, general limiter, and sanitizeInput. No other mount exists. Cookie config is HttpOnly and SameSite=Lax (`server/src/middlewares/session.ts:43`), which is useful but does not independently protect requests initiated from an untrusted sibling origin within the same site. Form URL encoding is enabled (`app.ts:80`).
- Failure: if an attacker controls an origin on the same registrable domain, a form can send authenticated state changes without server-origin/token validation. CORS prevents reading some responses; it does not authorize or block all form writes.
- Fix: consistent same-origin request validation or a robust CSRF-token strategy for cookie writes; deliberate handling of absent Origin, Fetch Metadata, OAuth callbacks and webhooks. Test cross-origin, same-site sibling, absent/null Origin, and form encodings. Do not treat the existing unused helper as a complete solution.

### SEC-07 — High conditional: production OAuth tokens may be stored as plaintext

- Checks: SECRET-07, SECRET-08.
- Evidence: `server/src/lib/token-crypto.ts:15` returns no key if absent; `:28` only warns in production; `:35` returns plaintext without a key; `:47` accepts legacy plaintext. Token columns live on the global User (`server/prisma/schema.prisma:48`).
- Failure: a production installation lacking TOKEN_ENCRYPTION_KEY stores Google refresh/access credentials unencrypted; a database-only disclosure exposes them. Provider disk encryption does not mitigate a query/export disclosure.
- Fix: fail startup for an enabled connector without a valid key; migrate existing tokens in a controlled rotation/backfill; store connectors scoped by workspace and user; use key versioning and tested rotation/recovery. Existing AES-256-GCM uses random IVs and authentication tags and can be retained after review.
- Verification: code fallback confirmed, deployed key presence and historic exposure unverified. Do not claim live secrets are leaked.

### SEC-08 — High conditional: missing SMTP silently reports success and logs invitation capabilities

- Checks: SECRET-10; transactional email crossreference.
- Evidence: `server/src/lib/email.ts:33` returns a mock transporter whenever SMTP credentials are absent, without a development-only guard; `:38` prints the entire message, which includes `inviteToken` via the URL at `:98`. `server/src/invites/service.ts:98` catches delivery failure and leaves invitation creation successful.
- Failure: production can report invitations sent while nobody receives them; logs contain seven-day invitation URLs. Those tokens are accepted without an authenticated session by `/api/invites/accept` (routes `:24`), although they do not themselves create a logged-in Google session.
- Fix: explicit development capture transport, production fail-closed email readiness, transactional outbox, redacted logging, hashed invitation tokens and verified intended identity at acceptance; track queued/sent/failed states rather than equating record creation with delivery.

### SEC-09 — High: email templates insert untrusted names and AI output as HTML

- Checks: API-10, AISEC-04.
- Evidence: `server/src/lib/email.ts:175` inserts inviterName into HTML; `:310` builds summary HTML with raw userName and summary at `:314` and `:316`. `server/src/services/openai.service.ts:126` validates presence but not string type/length or content safety.
- Failure: a crafted display name or generated summary can inject links/images or alter the mail's HTML. Many mail clients block scripts, so the demonstrated risk is content/phishing injection, not a proven JavaScript execution exploit. Source anti-script sanitization runs before body parsing and is not context-aware escaping (`server/src/app.ts:62`,`:79`).
- Fix: template engine with default escaping; render model output as plain text or a constrained sanitized format; bound and schema-validate model outputs. Keep output encoding per destination; do not mutate all input with regex.

### SEC-10 — High SaaS readiness blocker: no tenant identity, membership, or scoped data plane

- Checks: AUTHZ-03/04/09/10/11/12/13.
- Evidence: `server/prisma/schema.prisma:38` gives a user one global role; the schema has no Organization/Workspace/Membership or tenant ID on business rows. General users, sprints, summaries, settings, sync and admin operations use a single organization-wide namespace. Some resources have ownership checks, but there is no enforced tenant access layer or RLS migration.
- Failure: merely opening signup to customer domains creates one shared organization. Promoting a customer's user to global ADMIN gives broad application privileges; adding an org selector in the UI would not isolate server data. No present-tenants exploit is alleged because tenants do not exist yet.
- Fix architecture and migration described below. Must finish before public/customer signup is enabled. Keep existing data as an explicit legacy workspace, not implicitly assigned by email domain.

### SEC-11 — Medium: upload controls trust client MIME/extension and write before resource authorization

- Checks: API-01; storage crossreference.
- Evidence: `server/src/upload/multer-config.ts:78` trusts multipart mimetype plus extension; disk upload happens before service conversation membership check (`server/src/upload/service.ts:71`). The service throws at `:86` without cleaning this file on that path. No scanning/quarantine or per-workspace byte budgets were located; general files use a local disk path.
- Failure: an authenticated member can claim an allowed type for arbitrary bytes, or upload files to invalid/unowned conversations and consume disk without a corresponding usable record. This is not proof of executable server-side upload execution; downloads use attachment headers and filenames are sanitized.
- Fix: content sniffing, bounded archive/document parsers, quarantine and asynchronous malware scans as needed, quotas, authorize upload intent before allocating storage, cleanup failed writes, private object storage with authorized short-lived access. Treat unknown archive decompression ratio and upload workload as an abuse case in local tests.

### SEC-12 — High before launch: data rights and sensitive-action audit lifecycle are missing

- Checks: LEGAL-01/02/03/04/05/08; AUTHZ-07.
- Evidence: user delete is a soft deactivation (`server/src/users/service.ts:183`); route inventory has no self-service account/workspace export or erasure workflow. Audit output is mainly mutable application console logs; there is no AuditEvent table in the schema. Product source has no terms/privacy/refund links or account data-rights UI. Documentation mentions desired policies rather than implemented workflows.
- Failure: deleting/deactivating a user leaves messages, files, OAuth credentials and third-party sharing in place; the operator cannot prove how permission changes or deletion requests were processed. Applicable legal obligations depend on customer locations and contracts; this is a product-control gap, not a legal conclusion.
- Fix: data inventory and vendor inventory; workspace export; separate membership removal, account deactivation, anonymization/erasure and regulated retention; connector revocation and Drive sharing policy; append-only audit events with actor/tenant/target/action/time/correlation and redacted before/after; privacy/terms/DPA and incident runbooks reviewed for chosen launch markets.

## Additional controls to resolve

- Dependency audit reported **17 total advisories (7 critical, 5 high, 5 moderate)**; production dependency audit **7 (1 critical, 4 high, 2 moderate)**. Evidence: `docs/saas/evidence/npm-audit.log` and `npm-audit-prod.log`, from delivery reviewer. Advisory counts are not exploit counts; reachable paths must be triaged, especially body parsing and trust-proxy/IP parsing. Preserve lockfile integrity while updating in a coding phase.
- Only `.github/workflows/deploy.yml` is active, deploys main and installs an unpinned Railway CLI; there are no active PR security gates in that directory. Historical YAML under tests/CI_CD does not execute automatically.
- Broad request limits are in process memory and general API limits are not tenant/plan budgets; provider or app cost control is missing for AI jobs. Do not enable AI by default in a free pilot.
- Sprints include tasks without creator/assignee filters (`server/src/sprints/service.ts:80`) and task list nested includes do not independently scope descendants (`tasks/service.ts:116`). Decide explicit visibility rules, then enforce them on every data path rather than patching only the primary task endpoint.
- Full Git-history secret scan, production configuration, secret rotation, TLS/WAF/DNS, provider permissions, branch protection, runtime CSRF/OAuth testing, and regulatory documents outside the repository remain unverified. No claim of production safety or security certification is made.

## Recommended target authorization architecture

1. Retain a modular Express/React/PostgreSQL system initially. Introduce global User/Identity, Workspace as the customer/billing boundary, Membership (unique workspace+user), optional ProjectMembership and invitation bound to workspace. A separate enterprise Organization tier is deferred unless required; follow TARGET-ARCHITECTURE.md for final naming. Platform operators are distinct from customer workspace owners/admins.
2. A user may belong to multiple customers. Resolve requested workspace from route/host selector, but authorize membership server-side before trusting it. Build a request context with actor ID, workspace ID, current membership/permissions and correlation ID; do not pass actor or tenant from JSON body.
3. Every tenant-owned table has immutable workspaceId (or an explicit inherited path validated by composite FK). Use composite uniqueness/FKs to reject cross-workspace parent/assignee/conversation references at the database. Store tenant-local role on Membership. Define a small central permission vocabulary with own/project/workspace scopes rather than role comparisons scattered through controllers.
4. Enforce scoped repositories/data access and public DTOs for every HTTP, socket, worker, export/import and connector path. Raw Prisma access stays inside module repositories. Require tests with two workspaces, overlapping users, forged selectors and absent context. Ensure lists/counts/stats/nested joins use identical policies.
5. For shared PostgreSQL, add RLS as defense in depth after scoped code and migrations work. Run the app with a non-owner/non-BYPASSRLS role, force policies where appropriate, set workspace context with SET LOCAL within the same transaction/connection, and account for poolers and workers. Table owners/superusers bypass normal policies; adding policy SQL without role/transaction tests is not isolation. RLS does not replace object permissions or tenant-scoped jobs, caches, events and files.
6. Namespace socket rooms/cache/query keys/object paths/jobs by workspace and authorized resource; invalidate membership/session state and evict room subscriptions on logout, role change, deactivation or removal. Minimize event payloads and create durable audit events for sensitive actions.
7. Migrate in expand/backfill/validate/enforce/contract stages. Freeze writes or use a carefully defined dual-write period, create the legacy workspace, backfill every existing row and relation, validate no orphan or cross-workspace links, add constraints and policies, and only then expose workspace signup/switching. Take and restore-test backups before schema migration.
8. Separate authentication from connectors. Basic managed/vetted identity flow must work without Google Drive/OpenAI/SMTP credentials; each optional integration has capability readiness, workspace settings, encrypted user-specific grants, revocation, bounded retries and explicit consent. A global app OAuth configuration serves normal tenants; customer-provided IdPs/connectors are later enterprise features.

## Positive evidence and scope limits

Passport and express-session are vetted authentication/session components; Passport's installed session manager regenerates sessions at login (`node_modules/passport/lib/sessionmanager.js:28`). Session cookies are HttpOnly, SameSite=Lax and production Secure; HTTP deserialization rereads role and active status (`auth/passport-config.ts:225`). `/auth/me` and user DTOs explicitly select fields rather than returning OAuth tokens. Notes verify ownership (`notes/service.ts:139`), conversation messages verify membership, and downloads check owner/conversation/admin (`upload/service.ts:487`). Configured fixed redirect destinations, UUID IDs, explicit CORS origin, Helmet CSP and standard ORM queries provide useful foundations. These source-level strengths do not cancel the failed global policies or prove every deployment header/path.

Checklist verdicts, including narrowly scoped static passes and N/A explanations, are in `../CHECKLIST.csv`. UNVERIFIED is not a pass. Mobile-specific checks are N/A because there is no native/wrapped mobile client. No price/entitlement enforcement is assessed as working because billing does not exist yet.
