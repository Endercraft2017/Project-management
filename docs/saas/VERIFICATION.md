# Production candidate verification

Verified locally on 2026-10-28, on branch `production`, based on `f3cd5ed44714b939ad62fd83602c1c346427491c`. These results describe the reviewed source candidate. Hosted GitHub checks, live provider accounts and production deployment have not been verified by these local runs.

| Check | Result and scope |
|---|---|
| Frozen dependencies | `npm ci` passed; Node 24/npm 11, committed lockfile. No TLS/integrity/audit bypass or forced major downgrade. |
| Build and types | Full workspace build and typecheck passed. The shared workspace has no separate runtime build/tests; no test coverage is inferred from its placeholder scripts. |
| Frontend lint | Passed with zero errors/warnings, retaining `--max-warnings 0`. |
| Backend lint | Passed with zero errors and 175 visible warnings. Legacy typing/unused-variable debt remains; rules were not disabled to hide it. |
| Maintained backend tests | **132 tests, 16 suites passed.** Includes password/tenant/origin/validation/invitation, provider/worker and socket/file boundary behavior. |
| Frontend tests | **55 tests, 13 files passed.** Includes access/projects, draft retention, notification cache/polling, shared socket lifecycle and durable AI states. |
| Local onboarding | **5 checks passed**: private config generation, distinct secrets, repeat preservation, partial-pair refusal, explicit env-file/stdin operator bootstrap and repeat refusal. |
| Real PostgreSQL + HTTP | **36 checks passed.** Real cookie sessions, operator bootstrap/provisioning, activation/recovery, owner/seat guards, colliding tenant IDs, persisted CRUD, private notes, quotas and safe summary/settings/job routes. AI admission uses a mocked provider boundary, never a live inference call. |
| Real PostgreSQL + Socket.IO | **10 checks passed.** Password-issued cookies, forged selector rejection, membership/session revocation, suspension, current task ACL and quota contention. |
| Chat concurrency | **15 real PostgreSQL checks passed.** Concurrent reactions, fresh transactional send/edit/delete authorization, reply counters and disabled Drive writes. |
| Task hierarchy | **9 real PostgreSQL checks passed**, with multiple assertions each: concurrent opposite reparenting, cycle/depth rejection, complete subtree moves, rollups, cross-project/sprint rejection, sprint deletion races and nested task/sprint read ACL. |
| Worker and recovery | **14 checks passed**: 8 real worker/usage checks plus 6 encrypted database/file backup/restore checks. Wrong key/tamper and nonempty-target refusal included. Random sibling databases were removed; no off-site upload or hosted schedule was activated. |
| Live browser journeys | **7 Playwright journeys passed** using local Chromium and the real backend for console/company/project access. The company journey also changes login in a second tab in the same browser context and verifies the stale tab gets 409 before writing. Public carousel navigation, pause/focus/reduced-motion, responsive behavior, chunk fallback and legacy links also pass. |
| Dependency audit | Runtime graph: **0 advisories**. Full graph: **7 low, 0 moderate/high/critical**. Remaining entries stem from unpatched `deepmerge` in development Jest/configuration tooling (`@jest/core`, `create-jest`, `jest`, `jest-cli`, `jest-config`, `ts-jest`). Reassess upstream before public release; no general reachability or exploitation claim is made. |
| Credential guard | No high-confidence credential patterns in tracked/unignored files. This guard does not establish a full history or generic-password audit. Private env files are ignored. |
| DDL consistency | Provisioning SQL and its embedded TypeScript copy match. Actual provisioned schemas were exercised against PostgreSQL 16. |

The real database/HTTP/socket/recovery categories total **84 checks**. They are not 84 independent handbook controls, and test assertions within one check are not counted as separate tests. Synthetic fixtures were scoped to owned test schemas, sessions and sibling databases. ERP/customer/production data was not reset.

## Reproduce

From the repository root, use the toolchain and local setup in [README](../../README.md). Supply a separate loopback `TEST_DATABASE_URL` whose database name ends in `_test`; never use customer data. The HTTP and browser harnesses require an empty tenant/operator catalog and clean up their own fixtures. Run database harnesses sequentially.

```sh
npm ci --no-audit --no-fund
npm run build
npm run typecheck
npm run lint --workspace=server
npm run lint --workspace=client
npm run test:unit --workspace=server
npm run test --workspace=client -- --maxWorkers=2
node scripts/local-setup-smoke.mjs
npm run test:integration --workspace=server
node scripts/realtime-smoke.cjs
npm run test:chat --workspace=server
npm run test:hierarchy --workspace=server
npm run test:operations --workspace=server
npm run test:browser --workspace=server
npm audit --audit-level=moderate
npm audit --omit=dev
node scripts/check-committed-secrets.cjs
```

Install the pinned Playwright Chromium first. On this environment the browser runs used `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Recovery tests used PostgreSQL 16 tools from the existing local container through `POSTGRES_TOOLS_CONTAINER`; CI installs PostgreSQL 16 client tools. Neither setting is a production credential.

Historical broad backend suites contain obsolete route assumptions, placeholder assertions and shared-database cleanup. They remain visible, outside `jest.unit.config.cjs`, and have not been represented as passing or as whole-codebase coverage. CI runs the maintained suite and the retained real database harnesses explicitly.

## Visual evidence and limits

Representative console/access/project screens were reviewed at 360 and 1440 pixels in light/dark modes. Browser checks assert no viewport overflow. [Console capture](evidence/production/console-desktop.png) and [mobile project capture](evidence/production/projects-mobile.png) use synthetic companies; no passwords or setup links are included. Carousel screen provenance and the retained capture fixture are in `client/public/screens/provenance.json` and `docs/saas/evidence/ez-landing/`.

This is not a complete screen-reader, contrast, accessibility, load, penetration or legal-compliance certification. Large chat/chart chunks and backend warning debt remain. The source checklist retains its original 233 audit dispositions rather than turning unverified controls green.

## Launch limits

The current implementation is a limited pilot candidate. Paid billing/entitlements, operator MFA/recovery, versioned migration across existing tenant schemas, tenant export/deletion and 30-day item recovery, hosted daily/off-site backup operations, region/privacy decisions, production load/capacity, domain/provider setup and measured support/restore commitments remain launch gates. See [ordered rollout](ROLLOUT-CHECKLIST.md) and [decisions](DECISIONS.md). No live provider call, customer message, purchase, main-branch merge or deployment was performed.
