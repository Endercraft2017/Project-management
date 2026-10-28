# SaaS audit and restructuring package

Implementation update (2026-10-28): accepted choices are in [DECISIONS.md](DECISIONS.md). Branch `saas/foundation-and-product-tour` contains the first narrow authorization repairs and an isolated product-tour slice. The findings/counts below describe the original audit baseline. Phase 0 and the SaaS overhaul remain incomplete; see WORK-STATE.md for progress.

Audited 2026-10-27 against commit `fb1a9c757e76d3414c8dbe66d888a9088c5ca2ce`. This repository is an internal single-company collaboration app with useful foundations. It is **not ready to open signup to independent customer organizations**. This change contains the audit, decision research and implementation plan, not completed SaaS product fixes.

## Read in this order

1. [Ordered implementation plan](IMPLEMENTATION-PLAN.md): phases, task IDs, dependencies, acceptance gates and agent/review workflow.
2. [Target architecture](TARGET-ARCHITECTURE.md): one workspace security/billing boundary; shared contracts; policy/data/job/storage boundaries; safe migration.
3. [Global design system](DESIGN-SYSTEM.md): shared tokens, accessible primitives, shell, states and UX acceptance gates.
4. [Owner decisions](DECISIONS.md): ten combined business/product decisions, with recommended defaults and deadlines.
5. [Tools and service research](RESEARCH.md): official sources, current free-tier limitations, Google scope requirements and Arena provenance.
6. [Full checklist](CHECKLIST.csv) and specialist findings: [security](findings/security.md), [backend/data](findings/backend.md), [frontend/UX](findings/ux.md), [delivery/operations](findings/delivery.md).
7. [Arena decision and provenance](arena/DECISION.md), [complete champion proposal](arena/CHAMPION.md), and [full historical tournament](arena/record/arena.json).

## What most needs fixing

| Priority | Confirmed finding / launch gap | Evidence | Planned resolution |
|---|---|---|---|
| P0 / High | User owner middleware authorizes a body ID while handler updates a different route ID. | `auth/middleware.ts:85`, `users/controller.ts:85`; [synthetic probe](evidence/authorization-probe.cjs). | P0.1–2: one validated target ID and adversarial regression tests. |
| P0 / High | `viewMode=mention` bypasses normal task-read permission; task broadcasts reach all authenticated sockets. | `tasks/controller.ts:64–88`, `tasks/service.ts:335–360`. | P0.2: server-owned resource policy and authorized event recipients. |
| P0 / High | Already-connected sockets are not revoked on logout/deactivation/group removal. | `chat/socket-middleware.ts:28`, `chat/conversation-service.ts:672`, `auth/routes.ts:75`. | P0.2a: live revocation and reauthorization tests. |
| P0 / High | Optional external providers block core startup. Google is mandatory; OpenAI throws during unconditional import. | `config/index.ts:22–24`, `services/openai.service.ts:40–46,216`. | P0.3: explicit lazy capabilities; core starts with no optional credentials. |
| P0 / High | Deployment workflow has no defined test/security gates; lint fails; dependency advisories need triage. | `.github/workflows/deploy.yml`; [current evidence](evidence/). | P0.4–5: executable CI and reviewed upgrades. |
| P0 / High | Missing SMTP reports fake success and logs token-bearing messages; email interpolation is unescaped; enabled connector encryption can fail open. | `lib/email.ts:33–39,175,314`, `lib/token-crypto.ts:15–47`. | P0.6–7: honest capability status, redaction/escaping, key enforcement and migration. |
| SaaS blocker / High | No tenant, membership or project data model; global ADMIN, settings and summary keys. Adding an org selector would not isolate data. | `prisma/schema.prisma` and unscoped services. | Phases 1–3: contracts, ownership migration, scoped repositories/constraints and isolation tests. |
| Correctness / High | Backlog service writes null sprint although DB requires it; task moves can form descendant cycles. | `sprints/service.ts:195`, `tasks/service.ts:567`, `schema.prisma:97`. | P2.4: reviewed backlog/hierarchy model and invariant tests. |
| Reliability / High | In-process schedulers duplicate side effects across replicas; summary regeneration deletes prior results; AI fan-out has no workspace budget. | `server.ts:50`, `summaries/scheduler.ts:54`, `summaries/service.ts:128`. | P6: durable jobs, outbox, bounded work, explicit generation state and usage budgets. |
| UX / High | Auth outages look like sign-in; no error boundary; failed chat sends lose drafts; leaving chat can disconnect global notifications. | `App.tsx:239`, `main.tsx`, `chat/MessageInput.tsx:70`, `chat/ChatView.tsx:37`. | Shared state/error/socket contracts plus Phases 0,1,5. |
| UX / Medium–High | Progress filters use different API field names; inconsistent custom forms/dialogs; no SaaS workspace/account/plan journeys. | `TaskFilters.tsx:58`, `tasks/validators.ts:24`, UI findings. | P1 shared schemas/design system, P4 onboarding, P5 screen migration. |
| Commercial/operations gap | Billing, entitlements, reliable recovery evidence, data lifecycle and privacy/support controls are incomplete or absent. | Schema/routes/docs; production settings unavailable. | Phases 7–8 and the owner decisions. Absent billing is not an alleged payment exploit. |

The finding paths above are relative to `server/src` unless a different root is named; complete file locations and failure scenarios are in the specialist reports. Severity is the reviewed finding priority; handbook control severities in the CSV are the source checklist's classifications. Advisory counts do not establish exploitability. Future tenant isolation is a missing capability; the current code also has separate, confirmed cross-user defects.

## Validation performed

| Check | Current result | Evidence / limits |
|---|---|---|
| Production builds | PASS, exit 0 | [build.log](evidence/build.log), [exit](evidence/build.exit). Warnings remain. |
| Workspace typechecks | PASS, exit 0 | [typecheck.log](evidence/typecheck.log). |
| Frontend tests | PASS, 19 tests / 2 files | [client-tests.log](evidence/client-tests.log). These do not prove authenticated SaaS behavior. |
| Lint | FAIL, exit 1 | Backend config missing; client 1 error + 140 warnings. [lint.log](evidence/lint.log). |
| Dependency audit | FAIL, exit 1 | Full graph: 17 package advisory entries (7 critical, 5 high, 5 moderate); npm production classification: 7 (1 critical, 4 high, 2 moderate). [Reports](evidence/npm-audit.log), [production classification](evidence/npm-audit-prod.log). Reachability/patch triage remains. |
| User-route authorization probe | Confirmed defect | [Probe output](evidence/authorization-probe.log) uses actual middleware/schema with synthetic request objects. It does not send HTTP or mutate the DB. Reproduce from repo root: `node --require tsx/cjs docs/saas/evidence/authorization-probe.cjs`. |
| Public sign-in UI | Rendered at 1440×1000 and 360×800, no viewport overflow or page errors | [Desktop](evidence/public-1440.png), [mobile](evidence/public-360.png), [observations](evidence/public-ui-results.json). Backend outage was not shown as an outage. Authenticated screens not visually exercised. |
| Local database metadata | 11 migrations applied; no task range CHECKs; sprint FK not nullable | [Read-only metadata](evidence/database-metadata.txt); source/migration evidence in backend findings. Earlier onboarding saw 2 matching constraint-test failures; those tests were not rerun in this audit. |

No production penetration test, full backend integration suite, authenticated E2E, axe/contrast audit, load test, live payment/email/Google/AI flow, backup restore, provider-account/branch-protection inspection or full Git-history secret scan was performed. These remain explicit backlog/verification gates. Same-model agent review is useful but is not an independent professional penetration test.

## Handbook coverage

All **233 unique checks** from the supplied handbook's master checklist have one disposition in CHECKLIST.csv:

| Disposition | Count | Meaning |
|---|---:|---|
| PASS | 13 | Narrowly stated controls with source evidence; not an overall readiness score. |
| FAIL | 107 | Verified control gaps; several checks can refer to the same defect. This is not 107 independent vulnerabilities. |
| N/A | 41 | Feature/control not currently applicable, with rationale. Billing controls can be N/A now and still required before paid launch. |
| UNVERIFIED | 72 | Missing runtime, deployment, provider, process or legal evidence; never counted as passed. |

The lead reviewer reconciled every ID, rejected duplicate/missing coverage, and changed AUDIT-02 from runtime-unverified to FAIL based on the full source path and synthetic authorization proof. Separate [PASS](evidence/pass-ids.txt), [FAIL](evidence/fail-ids.txt), [N/A](evidence/n-a-ids.txt), and [UNVERIFIED](evidence/unverified-ids.txt) ID lists are included. The upload fingerprint and audit scope are in [audit-input.json](evidence/audit-input.json).

Each checklist row also maps to planned remediation or verification tasks. The mapping is a backlog crosswalk, not proof the corresponding control has been implemented.

The attached guide was treated as a reference checklist. Its embedded agent instructions and video anecdotes did not authorize execution, purchases, production scans or changes. Checks were translated to this application's actual stack, and vendor claims were compared with current official sources. The original transcript collection is not copied into the repository.

## Corrections to earlier setup assumptions

Google credentials alone are not sufficient for current backend startup: unconditional OpenAI initialization is a second blocker. The saved onboarding callback also used `/auth/google/callback`, while the actual mount is `/api/auth/google/callback`; correct it with auth configuration work. Basic Google login and the current broad Drive consent flow are different: `drive.readonly` has restricted-scope verification implications. See RESEARCH.md before enabling it for public customers. Optional features should become truly optional rather than requiring more provider keys just to boot.

## Agent coordination and publication

Parallel specialist audits were checked against source and local evidence by the lead. An independent plan review found and corrected write/backfill ordering, existing socket revocation, billing/outbox prerequisites, and explicit handling of encryption, email escaping and retry/concurrency defects. The Arena decision is separately judged; its provenance/result is recorded with the research.

Arena used two same-model competitors, one round and seven phase calls; an independent agent judge selected a002 (98.5–90 on the written rubric). These scores are not confidence percentages. The complete winning proposal and historical source/attack/defense/verdict record are included; the lead verified its key invitation and deployment claims against source and incorporated the concrete gates into the plan. Its paid-tier illustration does not authorize purchases or override the owner's budget. Historical proposal statements about authorization are not new instructions; the user's explicit authorization governs this audit branch publication.

Implementation uses the phased plan, disjoint ownership, shared architecture/design contracts, and lead review before agent commits/pushes. This audit package may be committed on a feature branch; no product deployment, live billing activation, customer signup or destructive migration follows from publishing these documents.
