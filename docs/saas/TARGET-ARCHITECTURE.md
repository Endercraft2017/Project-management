# Current E-Z architecture

[ADR-001](ADR-001-PRODUCTION-TENANCY.md) is the authoritative implemented architecture. It supersedes the historical shared-row/global-identity and external-console adapter proposals preserved under [history](history/).

Use a modular monolith: React/Vite, Express/TypeScript, Prisma, PostgreSQL and Socket.IO, with a separate worker process from the same reviewed source. `ez_control` holds company/operator/session/audit/usage/job metadata. Every business operation resolves a validated server-generated tenant schema through AsyncLocalStorage. A company code selects the local account namespace; it is not an access credential.

HTTP and socket identity come from server-issued sessions. Operator and company sessions use separate cookies, secrets and principals. A per-document sign-in context prevents a shared browser cookie change from silently retargeting another tab's HTTP requests or socket reconnects. It is a consistency assertion and cannot authorize a tenant by itself.

Task topology writes share a transaction-scoped tenant advisory lock. Reparenting validates cycles, project/sprint links and subtree depth; rollups and descendant levels commit together. Direct reads, nested responses and socket delivery use creator/assignee/admin access. Projects are company-visible; conversations and personal notes keep their stricter boundaries.

AI reserves quota before remote work and retains uncertain charges. Durable generation uses a canonical weekly key and one attempt; the HTTP request admits a job instead of holding a long provider loop. Files reserve tenant storage before disk writes. API processes do not run background cron loops.

Current operational limits and remaining gates are explicit in the [rollout checklist](ROLLOUT-CHECKLIST.md): resident tenant-client capacity, connection budgets, no installed database role/RLS boundary, operator MFA/recovery, schema evolution across existing companies, paid entitlements, export/deletion retention, hosted backup schedules and measured recovery. Neither schema separation nor local test success completes those controls.
