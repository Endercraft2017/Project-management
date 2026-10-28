# Worker, quotas and optional providers

Core startup requires neither Google nor OpenAI nor SMTP credentials. AI and outbound mail are off unless explicitly enabled. Nothing in this change activates a paid provider.

## Usage budgets

Tenant control records hold storage bytes used/limit and lifetime AI tokens used/limit. Defaults are100MiB storage and **zero AI tokens**. Storage reserves actual bytes atomically before writing and releases only that operation's known allocation on cleanup/deletion. Rejected or suspended tenants cannot reserve. The counters are hard admission controls, not a usage estimate displayed only in the UI.

AI requires all of: `AI_ENABLED=true`, a configured `OPENAI_API_KEY`, active tenant context and sufficient tenant token allowance. `OPENAI_MODEL` defaults to `gpt-4o-mini`; its availability and current price are not validated by local tests. One request allows14 updates,8,000characters/update,32,000UTF-8 prompt bytes and500 output tokens. Prompt bytes plus framing/output allowance are reserved conservatively before SDK construction; actual provider usage settles once. An unknown provider outcome stays charged at the full reservation. Expired reservations are never silently refunded. An operator must review uncertain cases before manually adjusting allowance. The allowance is cumulative, not a monthly reset or a currency-denominated spending guarantee; approve a model/rate and external provider budget before enabling it.

SDK retries are0 with a20-second request timeout. Distributed PostgreSQL reservations enforce one active request per tenant and2 globally (`AI_MAX_CONCURRENT`, bounded1–5). Errors and invalid/incomplete JSON are explicit failures. Summary generation does not replace provider failures with a fabricated LOW assessment; no-data members are omitted, and a whole failed generation persists no partial summary. A bounded batch allows at most50selected members; calls run sequentially. Completed provider calls still consume quota when later persistence fails.

## Durable worker

Build the server, then run a separate process using the same `DATABASE_URL`:

```sh
WORKER_ENABLED=true SCHEDULER_TIMEZONE=Asia/Manila node server/dist/worker.js
```

The API installs none of the former three cron/interval schedulers. The worker explicitly loads each ACTIVE tenant and enters AsyncLocalStorage context. Envelopes contain tenant ID, one allowlisted job kind, a bounded payload and a unique tenant/kind/idempotency key. Claims use PostgreSQL row locking/`SKIP LOCKED`,90-second leases,20-second renewals, fenced completion, bounded retry/backoff and a terminal FAILED state. Suspension prevents new claims and handlers reread current tenant status. This is an at-least-once queue; handlers must remain idempotent.

The worker scans once per minute. Note reminders catch due persisted rows; daily and weekly schedules catch the latest7days of configured occurrences after downtime. `SCHEDULER_TIMEZONE` is explicit; defaultUTC. There is no per-tenant timezone setting yet. More than7days of missed scheduled mail/reminders requires operator review; this is not unlimited historical replay. Catalog scans currently cover the store's500-tenant ceiling.

- Note reminders: persist a tenant-local Notification and `notifiedAt` in one transaction, using a stable notification ID. No separate-process Socket.IO singleton is required.
- Daily update reminders: stable per-user/date persisted notifications, up to200users per batch. Automatic SMTP delivery of daily reminders is intentionally not wired into this retryable handler. Existing UI polling reads notifications; mailbox delivery is a separate capability.
- Weekly summary email: only when tenant settings enable it and SMTP is configured. Fetch existing summary or generate with AI admission controls, then send and mark accepted. One job attempt only: SMTP cannot promise exactly-once delivery after an uncertain failure/crash. Do not automatically replay such attempts. Provider acceptance is not proof of inbox delivery.

Before and during a schedule scan, a bounded scan-phase heartbeat advertises process liveness; it is stopped and any pending write drained before exit. A successful job lease renewal refreshes worker readiness in the same fenced SQL statement; an expired or stale lease cannot refresh it. On shutdown the loop stops claiming after the current scan, lets in-flight work drain with lease renewal, and removes its readiness heartbeat on clean exit. A platform hard kill can interrupt the drain, so uncertain SMTP remains single-attempt and requires operator review.

Readiness indicates worker liveness, not successful delivery of a particular job; inspect queue status and age separately.

Worker heartbeats live in `ez_control.worker_heartbeats`; queued/running/done/failed envelopes in `ez_control.jobs`; AI reservations in `ez_control.ai_reservations`. Payloads/error codes are intentionally small; no raw prompts/provider errors or credentials are logged. These tables need retention/monitoring appropriate to actual workload; no pruning of idempotency evidence is enabled by default.

Example operator inspection (read-only SQL):

```sql
SELECT kind,status,count(*) FROM ez_control.jobs GROUP BY kind,status;
SELECT id,last_seen_at FROM ez_control.worker_heartbeats ORDER BY last_seen_at DESC;
SELECT tenant_id,status,sum(reserved_tokens),sum(actual_tokens)
FROM ez_control.ai_reservations GROUP BY tenant_id,status;
```

Manual scheduler triggering enqueues work; it does not claim a message was sent or the worker is running. The legacy `isSchedulerRunning()` reports false because an API cron is never active. Heartbeat inspection is the meaningful worker-readiness check. Retry a FAILED job only after reviewing the error code and any external delivery ambiguity; no public retry endpoint is provided.

## Mail

Mail requires `MAIL_ENABLED=true` plus `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; optional `SMTP_PORT` (default587) and `SMTP_SECURE` (e.g.true for465). Configure secrets securely in deployment settings. STARTTLS/TLS certificate verification stays enabled; file/URL loading is disabled in mail options. No mock success or raw invitation-link logging remains. Dynamic names, summary text and links are HTML-escaped. Public application URLs must use HTTPS in production. Test/provider send, DNS authentication, webhook/bounce handling and actual deliverability remain unverified until a real account/domain is configured.
