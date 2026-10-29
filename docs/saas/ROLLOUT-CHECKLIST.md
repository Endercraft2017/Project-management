# Ordered E-Z rollout checklist

Updated 2026-10-29. The production candidate implements SaaS foundations; it is **not a production-readiness declaration**. Original audit counts remain historical. Follow [ADR-001](ADR-001-PRODUCTION-TENANCY.md), the [runbook](../operations/production-runbook.md) and this order. Parallel work needs stable shared contracts and lead review before commits/pushes.

## Current progress

The earlier candidate was pushed to `production` and Railway deployed `a8157a85` successfully. Railway access, source branch, core readiness and the distinct operator session secret are verified. Custom-domain automated checks remain blocked by its WAF; authenticated customer/operator onboarding on that domain is not yet verified. Initial operator credentials have not been created by this review.

The follow-up adds operator password change/session revocation, editable existing-company account caps, explicit recovery reauthentication messaging and a production upload guard. The API has no verified persistent upload mount. The guard must stay closed until real durability and recovery are verified. See [hosting/provider research and consolidated next steps](HOSTING-AND-PROVIDERS.md) and [verification](VERIFICATION.md). The unchecked exits below remain broader launch requirements, not a denial of bounded checks already recorded.

The next source update adds private first-operator activation/expired-pending reissue, optional authenticator MFA enforced for enabled operators, one-use second-factor recovery codes, and bounded company-admin JSON export. See [operator setup/security](../operations/operator-access.md) and [export scope](../operations/workspace-export.md). These do not implement forgotten-password reset, complete portability/deletion, hosted backups or billing. Production account creation still requires the owner-selected email/name and secure setup-code delivery.

## 1. Freeze and validate the final candidate

Status: implemented foundations; final integration/review pending. Owner: integration lead and independent reviewers.

- [ ] Review the final diff and global architecture/design contract. One standalone operator principal, tenant-local accounts, generated schemas and no public/default fallback.
- [ ] Test colliding IDs/same-email accounts across two companies; wrong code/password, suspended tenants and operator/customer cookie separation.
- [ ] Recheck existing socket revocation, private conversation/file boundaries, quotas/cleanup, projects/backlog/conflicts, task invariants and concurrent reactions.
- [ ] Run frozen install, typecheck, both lint targets, build, maintained backend unit tests, real PostgreSQL/HTTP integration, frontend tests and retained browser journeys on the same artifact. Classify genuine skips and dependency findings.
- [ ] Retain exact logs/commit. Local browser and synthetic integration checks are not production penetration/load testing or complete WCAG certification.

Exit: no unexplained required failures; reviewers approve the actual final diff. Only then authorize the named branch publication. No main merge or deployment is implied.

## 2. Reproduce local operator/company setup

Status: implemented; bounded local evidence exists. Owner: developer/operator.

- [ ] Follow the root README from fresh configuration. Keep separate random session secrets; no Google/AI/SMTP account is needed.
- [ ] Bootstrap once through stdin/explicit env-file; repeat bootstrap must refuse. No default credential or public bootstrap endpoint.
- [ ] Exercise console login → create company → private one-use setup → explicit company login → app. Check failures, loading/empty states and token history/log hygiene.
- [ ] Verify status/storage/AI/account-cap controls, audit, member invitations and owner recovery. Pending accounts reserve slots; this is not active-member billing.
- [ ] Verify recent operator reauthentication, one-hour recovery and revoked old sessions. Verify optional authenticator enrollment/login/recovery and session revocation. Forgotten-password recovery remains separate work.

Exit: real API/database/browser flow, with no synthetic-success backend substitute.

## 3. Verify hosting, admission and the $0 envelope

Status: Railway project/service/ref/region and readiness observed; budget, capacity and durable uploads remain unverified. Owner: infrastructure/operator.

- [ ] Identify actual Railway service/ref/database, DNS/domain/PWA owner, region, TLS and persistence.
- [ ] Measure real free allowances and stop admission/capabilities before overages. No paid upgrade or uptime promise follows from advertised free tiers.
- [ ] Set a measured company admission cap within the current resident-client default of 32 per process. No eviction exists; at capacity new clients fail503 until deliberate capacity change/restart. Provisioning success is not a load test.
- [ ] Budget potential connections: up to79/API and69/worker by defaults, before tools/replicas. Confirm actual database limits. Catalog/worker listing currently stops at500.
- [ ] Verify branch protections, required checks, release approval and alternate auto-deploy paths. Current CI validates; it has no deployment credential.

Exit: named owners and measured resources support the admitted pilot. Scaling requires tested connection/client lifecycle, scanning and realtime/limit changes.

## 4. Rehearse worker, quotas and recovery

Status: tools implemented and locally exercised; hosted lifecycle unconfigured. Owner: operations.

- [ ] Run the retained operations harness against its guarded disposable local PostgreSQL database, with compatible PostgreSQL 16 tools and tar. It creates isolated sibling databases; never point it at production.
- [ ] Run the separate worker on the same reviewed artifact/database; verify heartbeat during a scan and a long job, graceful shutdown, duplicate admission, lease expiry and terminal failures.
- [ ] Verify bounded storage reservations/cleanup and AI admission without making a paid call. Tenant token limits are cumulative; an uncertain result stays conservatively charged.
- [ ] Configure encrypted backups outside the app's upload/public directory and keep the key in independent secure storage. Verify private off-site bucket policy, least privilege, allowance and restore access before enabling uploads.
- [ ] Schedule daily backups and explicit seven-copy retention/alerts; scripts do not silently install a scheduler or delete old copies. Rehearse a fresh-empty-target database/file restore and measure RPO/RTO.
- [ ] Implement and test a compatible 30-day deleted-item recovery mechanism before promising it. Seven daily copies alone cannot meet that target. Define tenant export/deletion and key/backup expiry together.

Exit: hosted schedules/alerts and an independently recoverable copy are evidenced; recovery and uncertain external-effect handling are owned. Local tooling alone does not meet this exit.

## 5. Activate only the chosen optional providers

Status: bounded AI workflow and typed settings implemented; real providers unconfigured. Owner: product/operations.

- [ ] AI: approve provider/model/rate, customer-data disclosure, real free allowance and numeric tenant caps. Enable globally and for a pilot company only within the $0 envelope; zero remains the default. Confirm summary availability and worker readiness before admission.
- [ ] Exercise `POST /api/summaries/generate` → 202 job → tenant-admin job status → persisted summary. A canonical week has one durable job and one attempt; retries return its existing status. FAILED jobs do not silently rerun and prior summaries are not overwritten.
- [ ] SMTP: enable only after real sender/TLS/DNS/bounce handling and safe test delivery are verified. Provider acceptance is not inbox delivery; uncertain weekly email outcomes require operator review rather than automatic replay.
- [ ] Keep Google/Drive/Sheets disabled in this candidate. Future basic Google login is a separate tenant-bound identity implementation. No customer supplies their own OAuth credentials for ordinary platform login.
- [ ] Keep legacy direct summary email/delete/manual triggers, arbitrary settings and direct reminder actions disabled; do not route around durable admission from a UI control.

Exit: each enabled capability has live sandbox/pilot evidence, ownership and a verified cost stop. No enablement follows merely from adding environment variable names.

## 6. Complete commercial, privacy and support controls

Status: remaining product/operational work. Owner: business/product and qualified advisers as needed.

- [ ] Define active-member billing semantics, prices, currencies, numeric allowances, grace/downgrade/refund/cancellation and data retention. Current account slots are not the billing meter.
- [ ] Select a Philippines-eligible payment provider and obtain actual account approval. Implement hosted checkout, signed/deduplicated/reorder-safe webhooks, reconciliation and authoritative server-side entitlements; test mode first.
- [ ] Complete privacy/terms/vendor disclosures, cross-border data assessment for PH/US/UK/EU customers and export/deletion controls. A code audit does not certify legal compliance.
- [ ] Name the support/security/incident owner and calendar, publish the support email and test escalation. The one-business-day restore is a target pending measured operations.
- [ ] Configure scrubbed logs/alerts and review dependency/security findings. Operator forgotten-password recovery, broader account lifecycle and public self-service signup remain follow-up work.

Exit: no charging or public recovery promise precedes the implemented/tested policy and operational owner.

## 7. Release a bounded pilot, then reassess

Status: earlier pilot source deployed; commercial/public rollout exits remain open. Owner: release lead.

- [ ] Accumulate remaining choices in [DECISIONS.md](DECISIONS.md); do not reopen accepted brand, country, scope or standalone-console choices.
- [ ] Publish only the exact reviewed branch/commit after lead review. Deployment, DNS changes, provider activation and main merge need their own authorized concrete action.
- [ ] Verify staging desktop/mobile/light/dark/reduced-motion and keyboard workflows, API/socket/file isolation, quota exhaustion and backup recovery. Perform authorized bounded staging load/security testing and manual accessibility review.
- [ ] Review the installed root-scoped PWA/cache path as well as fresh clients before replacing the live app shell. Preserve domain routing and intentional offline data.
- [ ] After deployment, verify actual readiness, tenant provisioning/login, worker queues, private files, alerts and backup schedule. Stop admission when measured resources or spending/recovery targets are exceeded.

Exit: a named small pilot has evidence and an owner. Re-audit enabled controls and remaining findings before expanding public/paid availability. The original 233-check CSV remains a historical baseline until each control is revalidated with new evidence.
