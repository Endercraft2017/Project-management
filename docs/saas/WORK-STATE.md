# Work state and handoff

As of 2026-10-27. This file is the short entry point for implementation agents; follow the linked contracts rather than relying on chat history.

## Completed in the audit phase

- Reviewed the uploaded handbook as reference data and mapped all 233 checks. See CHECKLIST.csv; FAIL and UNVERIFIED remain open work, not completed fixes.
- Parallel security, backend/data, frontend/UX and delivery reviews; lead source verification; independent rollout/security/design reviews.
- Current local build/typecheck/frontend test and dependency/lint evidence, synthetic authorization reproduction, public desktop/mobile browser observations and read-only local DB metadata.
- Official-source free-tier/tooling research; bounded Arena architecture decision and provenance are retained with this package when finalized.
- Ordered implementation plan, target architecture, global design specification and one owner-decision register.

## Product implementation status

No product implementation task is complete in this change. Existing authorization, startup, CI, tenancy and UX findings remain in the application. No paid account, production deployment, destructive migration, real customer messaging or billing activation was performed.

Next actionable phase: **Phase 0** in IMPLEMENTATION-PLAN.md. Start with a disposable test harness and the exact ownership/task-read/socket regression tests, then fix those boundaries. Use separate authors/reviewers for security changes. Optional-provider gating must preserve authentication on protected resources.

Most Phase 0 tasks can proceed without brand, hosting or pricing answers. D2 and D4 must be resolved before the production data/permission migration; D3 before customer identity integration; D5–D8 and D10 before the affected provider/commercial/operational launch gates. Do not reset data or broaden current privacy rules by assumption.

## Required context for every implementation agent

Read README.md, the current phase in IMPLEMENTATION-PLAN.md, TARGET-ARCHITECTURE.md, DESIGN-SYSTEM.md and DECISIONS.md. Use one Workspace security/billing concept, shared runtime API schemas, scoped policies/repositories, and shared UI primitives. Do not create an independent token/component/session/permission system inside a feature. Respect disjoint ownership; contracts, migrations, lockfiles and global design tokens have one writer at a time.

Report the changed behavior, targeted checks and unresolved risks. The lead reviews the diff and evidence before authorizing a commit/push on a feature branch. Never merge/deploy or mark a phase complete on a build result alone. Update this handoff and checklist only for controls actually revalidated.
