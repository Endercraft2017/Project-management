# Work state and handoff

Current E-Z alignment update (2026-10-28): branch saas/ez-landing-and-tenant-alignment. Brand, seller/markets and public-root routing are clarified in DECISIONS.md. The landing now uses official E-Z assets and actual UI captures with demo data; existing app/legacy links and Google return to /app are preserved. ERP branch 5b974e0 was reviewed read-only. EZ-TENANT-AND-LANDING-PLAN.md defines reuse of the existing operator console through product grants/adapter; tenant-code/password login and that adapter are not implemented. No live-domain deployment, DNS edit, reset, purchase or ERP modification occurred.

Verification for this slice: full workspace build passes; 19 frontend tests, 24 focused backend tests and six retained browser tests pass. Changed client lint exits 0 with two existing AcceptInvite warnings. Independent mobile/tablet/desktop and reduced-motion review passed. Broader SaaS/production/authentication checks remain open.

Active 2026-10-28 update: owner choices are recorded in DECISIONS.md. Branch: saas/foundation-and-product-tour. Exact-ID owner and task-read authorization repairs were reviewed and pushed as 96dc163. The isolated /tour carousel and pinned design guidance passed lead/independent review. No reset, purchase or deployment was performed.

Latest verification: full workspace build exit 0; changed client source/config/browser-test ESLint exit 0; 20 focused backend tests and 19 existing frontend tests pass; four retained Playwright browser tests pass. Frozen dependency install passes with a minimal lockfile update for pinned Swiper and Playwright. Screenshots, regression output and review limits are in evidence/ and IMPLEMENTATION-UPDATE.md. Existing repository-wide lint/advisory findings remain open; no claim of complete Phase 0 or SaaS readiness.

As of 2026-10-27. This file is the short entry point for implementation agents; follow the linked contracts rather than relying on chat history.

## Completed in the audit phase

- Reviewed the uploaded handbook as reference data and mapped all 233 checks. See CHECKLIST.csv; FAIL and UNVERIFIED remain open work, not completed fixes.
- Parallel security, backend/data, frontend/UX and delivery reviews; lead source verification; independent rollout/security/design reviews.
- Current local build/typecheck/frontend test and dependency/lint evidence, synthetic authorization reproduction, public desktop/mobile browser observations and read-only local DB metadata.
- Official-source free-tier/tooling research; bounded Arena architecture decision and provenance are retained with this package when finalized.
- Ordered implementation plan, target architecture, global design specification and one owner-decision register.

## Original audit implementation status (2026-10-27; superseded by active update above)

No product implementation task is complete in this change. Existing authorization, startup, CI, tenancy and UX findings remain in the application. No paid account, production deployment, destructive migration, real customer messaging or billing activation was performed.

Next actionable phase: **Phase 0** in IMPLEMENTATION-PLAN.md. Start with a disposable test harness and the exact ownership/task-read/socket regression tests, then fix those boundaries. Use separate authors/reviewers for security changes. Optional-provider gating must preserve authentication on protected resources.

Most Phase 0 tasks can proceed without brand, hosting or pricing answers. D2 and D4 must be resolved before the production data/permission migration; D3 before customer identity integration; D5–D8 and D10 before the affected provider/commercial/operational launch gates. Do not reset data or broaden current privacy rules by assumption.

## Required context for every implementation agent

Read README.md, the current phase in IMPLEMENTATION-PLAN.md, TARGET-ARCHITECTURE.md, DESIGN-SYSTEM.md and DECISIONS.md. Use one Workspace security/billing concept, shared runtime API schemas, scoped policies/repositories, and shared UI primitives. Do not create an independent token/component/session/permission system inside a feature. Respect disjoint ownership; contracts, migrations, lockfiles and global design tokens have one writer at a time.

Report the changed behavior, targeted checks and unresolved risks. The lead reviews the diff and evidence before authorizing a commit/push on a feature branch. Never merge/deploy or mark a phase complete on a build result alone. Update this handoff and checklist only for controls actually revalidated.
