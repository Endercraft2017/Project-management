# E-Z production-candidate runbook

Updated 2026-10-29. This runbook prepares and validates the **production branch candidate**. Its instructions do not themselves authorize paid providers, DNS edits or destructive resets. Read [ADR-001](../saas/ADR-001-PRODUCTION-TENANCY.md) first. The new E-Z console is standalone; no ERP console or external tenant catalog is required. See the dated [hosting and provider review](../saas/HOSTING-AND-PROVIDERS.md) for observed Railway state and remaining gates.

## 1. Establish the target and capacity

Confirm the exact repository/ref, Railway project/service/database, custom-domain owner, region and current data owner. The owner permits reset only of identified E-Z test data. Record any retained data and recovery point before changes. A branch push is not deployment, and the public domain's current HTML does not prove which service/ref is authoritative.

Use a distinct development/test database and secure production configuration. Do not run integration fixtures against a customer database. Keep the pilot below a measured tenant/connection/resource budget. The current per-process cache permits 32 distinct tenant clients, with no eviction and 503 at capacity; pool defaults permit up to 79 API or 69 worker connections before extra tools/replicas. Those are upper bounds, not an approved Railway allowance. Restarting clears resident caches but is not a scaling strategy. Catalog/worker listing is capped at 500. Do not admit additional companies merely because provisioning succeeds.

## 2. Configure secrets and core URLs securely

| Setting | Requirement |
|---|---|
| `DATABASE_URL` | Intended PostgreSQL database; use provider-supported verified TLS. Core/control and tenant schemas share this database. Never expose it through Vite. |
| `SESSION_SECRET` | Random secret of at least 32 characters from a secret manager; tenant sessions. |
| `CONSOLE_SESSION_SECRET` | Different random secret of at least 32 characters; needed for the console. Console returns unavailable when absent. |
| `NODE_ENV`, `PORT` | Production mode on the deployed service; Railway-provided service port. Local development uses the normal scripts. |
| `CLIENT_URL`, `CORS_ORIGIN` | Exact approved origin, normally `https://ez.afkcube.com`; credentialed wildcard origins are not the setup. |
| `APP_URL` | Same public origin when email links are enabled. Production mail links require HTTPS. |
| `AI_ENABLED`, `MAIL_ENABLED`, `WORKER_ENABLED` | Disabled/unset initially. Their configuration is separate from creating a tenant or setting a numeric limit. |
| `TENANT_DB_MAX_CLIENTS`, `TENANT_DB_POOL_SIZE` | Defaults 32 and 2; validate database capacity before changing. Allowed ranges 1–128 and 1–10. |
| `UPLOAD_DIR`, `STORAGE_PERSISTENCE_CONFIRMED` | Production uploads require an absolute private directory and confirmation exactly `true`. Verify the actual persistent mount, permissions and backup/restore first. A directory name or confirmation flag alone does not provide durability. Otherwise new uploads return 503 before parsing/reserving/writing; authorized reads and deletion remain available. Development/test keep local uploads. |

Do not paste secret values in chat, command arguments, Git, `.env.example` or logs. Do not reuse local test secrets in production. The initial operator has no default password and no public bootstrap endpoint. Google/AI/SMTP credentials are not needed for core boot; Google login/Drive/Sheets remain disabled in this candidate.

## 3. Install, build and validate

From the repository root:

```sh
npm ci --no-audit --no-fund
npm run prisma:generate
npm run typecheck
npm run lint --workspace=server
npm run lint --workspace=client
npm run build
npm run test:unit --workspace=server
npm run test --workspace=client -- --maxWorkers=2
```

The reviewed toolchain uses Node 24.19.0/npm 11.9.0. The Railway config uses Railpack, builds with `npm run build`, starts with `npm start`, uses one API replica and checks `/health/ready`. `nixpacks.toml` is a legacy fallback, not evidence of the active builder. Verify actual platform overrides and plan resources. Railway's deployment healthcheck does not provide continuous monitoring; configure a separate monitor and alert owner.

For real API/database/browser tests, provide `TEST_DATABASE_URL` for a **disposable local** PostgreSQL database ending `_test`, without a selected tenant schema. The harness refuses existing tenant/operator data. Follow its ownership/cleanup rules:

```sh
npm run test:integration --workspace=server
npm run test:browser --workspace=server
```

Install the lockfile-pinned Playwright browser when needed. Maintained backend unit tests are separate from historical placeholder/shared-DB feature suites. Inspect expected test counts, failures and skips; do not relabel a skipped suite as passed. The dependency-audit gate must also pass or have an explicit reviewed release decision; a package advisory count is not a reachability finding.

The current CI validates and retains an artifact; it has no deployment credential or Railway release step. Verify actual branch protection, required checks, deployment approval and alternate auto-deploy paths externally. Do not claim that a YAML file enabled those account settings.

## 4. Bootstrap the first operator through stdin

Start from a trusted terminal with the intended `DATABASE_URL` and separate secrets already supplied securely. The bootstrap CLI accepts exactly one JSON object through stdin; it refuses command-line credential arguments and refuses bootstrap when any operator already exists. It stores a bcrypt hash and prints only public operator fields.

One interactive way to avoid passwords in shell history/argv is:

```sh
set -o pipefail
python3 -c 'import sys,json,getpass
print("Operator email: ",file=sys.stderr,end="",flush=True); email=input()
print("Operator name: ",file=sys.stderr,end="",flush=True); name=input()
password=getpass.getpass("Operator password: ")
sys.stdout.write(json.dumps({"email":email,"name":name,"password":password}))' \
  | npm run bootstrap:operator --workspace=server
```

Input prompts go to the terminal, while only JSON enters the pipe. Alternatively a trusted secret manager can send the JSON stdin directly. Never save an operator JSON file in the checkout or put a password in the command text. New passwords need at least 12 characters and at most 72 UTF-8 bytes. If bootstrap is already disabled, do not clear the operators table to regain access; use an independently reviewed operator recovery procedure. Operator MFA/self-service recovery is not implemented.

An authenticated operator can change their password under **Operator account security** in `/console/tenants`. The current password is required. A conditional database update and credential-free audit commit together; the operator session version increments, revoking other sessions. The current session is regenerated. If cookie renewal fails after commit, the UI explicitly requests sign-in with the new password; do not assume the old password was restored. This is password change for a signed-in operator, not forgotten-password recovery or MFA.

## 5. Start the API and provision a company

```sh
npm start
```

API startup checks the database and ensures the control schema; it does not replay the legacy public-schema migrations or start tenantless cron jobs. `/health/live` proves HTTP process liveness; `/health/ready` checks required database/control readiness. Neither proves an external integration works.

1. Sign in at `/console/login` with the operator account; the console lives at `/console/tenants` and uses its own API principal/cookie.
2. Create the company with `name`, `ownerEmail`, `ownerName` and chosen caps. Backend fields are `seatLimit`, `storageLimitBytes`, `aiTokenLimit`; defaults are 10 reserved account slots, 100 MiB storage, zero AI tokens. Console storage inputs display MiB and send bytes. These are limits, not live payment entitlements or an invented active-seat meter.
3. Provisioning records PROVISIONING, creates a random tenant schema and owner transactionally, then records ACTIVE or FAILED. A company code and setup link are shown once on success. Copy the link only to an approved private channel. No automatic email or known-password account is created.
4. The owner opens `/activate?tenantCode=...&token=...` and sets a password within 24 hours. The page removes the token from browser history and does not auto-login. Then sign in at `/login` using company code+email+password and enter `/app`.
5. Verify projects/task creation and a second company with colliding IDs/same email. Wrong company/password, suspended company, customer cookie used against the console and operator cookie used against tenant APIs must fail appropriately.
6. Tenant admins can create bounded member invitations; pending accounts reserve capacity. Share one-use links securely. Operator owner recovery requires signing in again if the last operator authentication is older than 15 minutes, and its replacement link expires after one hour. Review audit entries and verify old sessions are revoked on redemption.
7. Use suspend/resume and quota controls deliberately. Suspension is not deletion and does not erase data. A FAILED provisioning record is not a ready tenant; investigate its safe audit/error state before retrying. No public purge/reset button is implied.

The same email in two companies represents two tenant-local accounts. A code, URL, browser storage value or role string alone never authorizes access. No cross-product SSO is configured.

## 6. Enable durable background work deliberately

After API/tenant checks and resource budgeting, use a **separate worker service/process**, not an extra API cron loop:

```sh
WORKER_ENABLED=true SCHEDULER_TIMEZONE=Asia/Manila node server/dist/worker.js
```

Use the same reviewed release and database. This is an example selected timezone; current default is UTC and there is no per-tenant timezone field. Confirm intended schedule semantics. Check `workerIsReady()`/heartbeat and queue state, not only a PID. Scan-phase heartbeats cover a long initial scan; job renewals refresh readiness only for valid leases; clean shutdown removes it. Readiness indicates liveness, not proof every queued job delivered.

See [worker/budget operations](worker-and-budgets.md) for seven-day catch-up, durable notification handlers, bounded retries and safe error codes. Daily reminders currently persist in-app notifications; automated SMTP for them is not claimed. Weekly SMTP jobs have a single attempt because acceptance can be uncertain after a crash. A platform hard kill can interrupt draining; inspect affected jobs before replay.

## 7. Configure encrypted backup lifecycle before external launch

Use [backup/restore operations](backup-restore.md) for exact commands and safeguards. Supply `BACKUP_KEY` from independent secure key storage, a private persistent `BACKUP_DIR`, compatible PostgreSQL tools and a coordinated write pause when including uploads. The authenticated database dump includes control catalog and tenant schemas; uploads require their own encrypted artifact. External object stores are not silently covered.

The local synthetic drill verifies full decryption, database/file restore and wrong-key/tamper/nonempty-target refusal. It does not establish a production schedule or off-site durability. To configure a private bucket, verify its actual access policy, endpoint/credentials, least privilege, versioning/immutability and budget, then explicitly enable the upload path. Never store the key beside the backups.

Set and monitor the daily schedule, seven-copy retention and restore alerts only after checking the $0 allowance. The scripts do not silently schedule or delete old copies. Rehearse restoration into a new empty target and compare tenant mapping, representative data/files, session/revocation state and application flows. Measure the actual RPO/RTO. The one-business-day restore and 30-day deletion recovery are owner targets, not current SLAs; seven daily snapshots cannot provide a universal 30-day deleted-item recovery mechanism.

## 8. Activate real providers only after their gates

- AI: zero allowance by default. Need explicit enable+key+approved model/rate+tenant cap and privacy review. Calls have bounded input/output/concurrency, no SDK retries and conservative settlement; local provider mocks are not a live inference test. A token cap is not a currency-denominated guarantee.
- SMTP: need explicit enable and real verified sender/TLS configuration. Current local tests did not send mail. Provider acceptance is not inbox delivery; verify SPF/DKIM/DMARC, bounce/complaint handling and safe retries before customer promises.
- Billing: no checkout/subscription/webhook/active-member billing implementation is activated. Philippines seller eligibility, exact prices/currencies/refunds, Paddle versus a PayMongo-local option and account approval remain gates. Direct Stripe PH seller accounts are not established by the current supported-country list.
- Google: login routes are disabled, and Drive/Sheets are excluded. A future basic-sign-in implementation needs tenant binding/state/PKCE and actual approved credentials; adding keys alone does not enable it.
- Monitoring/privacy: configure real alert owners, retention and scrubbing; assess PH/US/UK/EU vendor/transfer obligations. No compliance certification or production penetration test is claimed.

## 9. Publish only the reviewed release

Confirm the authoritative Railway/domain/PWA source and preserve `/`, `/login`, `/activate`, `/console/*`, `/app`, `/api/*` and `/socket.io` routing. Inspect fresh and previously installed clients; an old root-scoped service worker can serve a cached app shell. Do not blindly purge unrelated offline data.

Run the final gates on the exact reviewed commit/artifact, inspect staging and recovery evidence, then request the authorized release action. No documentation change or branch publication applies external settings. After deployment verify readiness, login/provisioning/isolation, quota failures, worker heartbeat/queues, file access and backup schedule from the actual instance. Stop admission if capacity, spending or recovery requirements exceed the approved pilot envelope.

## Old Google sign-in page or CAPABILITY_DISABLED in the browser

The supported company login is `/login`, using company code, email and password. No Google OAuth credentials are needed. Old tabs/bookmarks can still point to `/api/auth/google`; browser HTML navigation now redirects to `/login?error=google_disabled`. API requests asking for JSON keep the honest 503 disabled-capability response. HTML entry documents use `Cache-Control: no-store`; hashed assets remain immutable.

If the hosted page still shows only Google login, verify the Railway deployment source and build:

1. Source branch: `production`, at the latest reviewed commit.
2. Root directory: repository root, not `server` or `client` alone.
3. Build command: `npm run build`; start command: `npm start`; production environment: `NODE_ENV=production`.
4. Redeploy that commit so the frontend and API are rebuilt together. Open `/login` in a fresh tab or hard-refresh. Purge an older cached HTML document if an external CDN overrides origin cache headers.

A Git push does not itself switch a Railway service's configured branch or guarantee a successful deployment. Check the deployment commit/build logs in Railway. `/api/auth/capabilities` should report password login enabled and Google disabled; the `/login` form should show company code, email and password. Do not enable Google to compensate for an old frontend.

After a full repository build, `npm run test:built-ui --workspace=server` exercises the compiled frontend served by production Express, including old-link redirects, native fields, JSON API behavior and HTML cache headers. It requires the guarded local test-database variable and installed Playwright Chromium, and uses no customer credentials or provider calls.
