# E-Z — Skip the basic

E-Z is a project-management and collaboration app built with React/Vite, Express/TypeScript, Prisma, PostgreSQL and Socket.IO. The production-branch candidate adds company-code/email/password login and a **standalone E-Z operator console**, with a server-generated PostgreSQL schema per company. Core startup requires no Google, AI or SMTP account.

This is a reviewable candidate, not a claim that paid billing, external providers or off-site backups are configured. Read the [production runbook](docs/operations/production-runbook.md), [current ADR](docs/saas/ADR-001-PRODUCTION-TENANCY.md), [ordered rollout](docs/saas/ROLLOUT-CHECKLIST.md), [observed hosting/provider review](docs/saas/HOSTING-AND-PROVIDERS.md) and [decision register](docs/saas/DECISIONS.md).

## Local setup

Use Node 24.19.0/npm 11.9.0 and Docker or a compatible PostgreSQL 16 service. From the repository root:

```sh
npm ci --no-audit --no-fund
node scripts/setup-local-env.mjs
docker run --detach --name ez-postgres --env-file .env.local \
  --publish 127.0.0.1:5432:5432 \
  --volume ez-postgres-data:/var/lib/postgresql/data \
  postgres:16-bookworm@sha256:d81f7b51697014367236d07ec58b54153fc28f828b72bf247fe5c7487520bcb0
docker exec ez-postgres pg_isready -U ez_local -d ez_development
npm run build
```

The helper creates ignored, private `server/.env` and root `.env.local` with fresh local database/session secrets, prints no values and preserves an existing pair. A partial pair is refused for manual reconciliation. `.env.local` supplies the local database container; backend development scripts read `server/.env`. Never commit either or reuse local secrets in production. Existing containers/volumes are preserved: if the name exists, confirm ownership before reusing it, and do not delete unknown data to make setup pass.

Wait for PostgreSQL readiness. Bootstrap the first operator through stdin, without passwords in shell history/arguments:

```sh
set -o pipefail
python3 -c 'import sys,json,getpass
print("Operator email: ",file=sys.stderr,end="",flush=True); email=input()
print("Operator name: ",file=sys.stderr,end="",flush=True); name=input()
password=getpass.getpass("Operator password: ")
sys.stdout.write(json.dumps({"email":email,"name":name,"password":password}))' \
  | node --env-file=server/.env node_modules/tsx/dist/cli.mjs \
      --tsconfig server/tsconfig.json scripts/bootstrap-operator.ts
npm run dev
```

Bootstrap is disabled once any operator exists. Passwords need at least 12 characters and at most 72 UTF-8 bytes. Open `http://localhost:5173` consistently; mixing localhost and 127.0.0.1 can break cookie/origin checks.

1. Sign in at `/console/login`, then create a company at `/console/tenants`.
2. Share the returned one-use setup link privately with its owner. It expires after 24 hours; no automatic email is promised.
3. The owner sets a password at `/activate`, then signs in at `/login` using company code+email+password. Activation does not auto-login.
4. `/app` is the workspace, `/app#/projects` project management, and `/`/`/tour` the public landing. The same email can have separate tenant-local accounts in several companies.

Google/Drive/Sheets are disabled. AI has zero allowance by default; SMTP and the worker require explicit activation. Local core development needs no provider signup.

Signed-in operators can change their password in the console, revoking their other sessions. Private one-use [operator activation and authenticator MFA](docs/operations/operator-access.md) are available; forgotten-password recovery remains separate work. New production uploads stay unavailable until an absolute private `UPLOAD_DIR` on verified durable storage is configured with `STORAGE_PERSISTENCE_CONFIRMED=true`; local development uploads remain available. An operator confirmation flag does not itself mount storage or establish backup recovery. Company admins can download a bounded JSON snapshot from Admin Settings → Workspace data; [export coverage and limits](docs/operations/workspace-export.md) are explicit.

## Validation and operations

```sh
npm run typecheck
npm run lint --workspace=server
npm run lint --workspace=client
npm run build
npm run test:unit --workspace=server
npm run test --workspace=client -- --maxWorkers=2
```

API/browser harnesses require a **disposable local** `TEST_DATABASE_URL` ending `_test`, without existing tenants/operators. Never use a customer database:

```sh
npm run test:integration --workspace=server
npm run test:browser --workspace=server
```

After explicit local enablement, the separate worker starts with:

```sh
WORKER_ENABLED=true node --env-file=server/.env server/dist/worker.js
```

See [worker/quotas](docs/operations/worker-and-budgets.md) and [encrypted backup/restore](docs/operations/backup-restore.md). Defaults are 10 account slots, 100 MiB storage and zero AI tokens per company; these do not implement active-member subscription billing. The tenant-client cache cap is 32 **per process**, without eviction. Measure actual database capacity before admission.

The [audit package](docs/saas/README.md) retains the original 233-check baseline, findings and Arena/design/service provenance. The current ADR/runbook supersede mandatory-Google, shared-row/global-identity and external-console plans. No merge, deployment, DNS change, purchase or production reset follows from this README.
