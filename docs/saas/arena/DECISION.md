# Arena architecture decision record

## Method and provenance

The user requested the Arena skill on GitHub. Multiple projects use that name; the directly matching [Jakeschincariol/arena-skill](https://github.com/Jakeschincariol/arena-skill) was selected. Its full skill and Python bookkeeping program, rubric and strategy data were read before use; no unvetted installation command was executed. Upstream is pinned to `df07b8e518e10cdecd8cd7712d9958b6f396250e`; file SHA-256 hashes and original MIT notice are retained in `vendor/provenance.json` and `vendor/LICENSE`.

Configuration: 2 independent same-model competitors, one round, 7 phase calls (2 proposals, 2 attacks, 2 revised defenses, 1 independent judge), seed `271026`. Competitors received one identical standalone task and distinct strategy cards. Initial two proposals were serialized to fit active audit concurrency; after those completed, parent authorized waves of two for independent attacks and defenses. Total actual waves: 5. Barriers were preserved between phases.

Orchestrator ran `bracket.py` and did not read candidate/attack/defense files or choose the winner. A separately spawned judge scores both revised proposals against the supplied rubric: correctness30%, completeness25%, specificity15%, robustness20%, clarity10%. These are rubric scores, not empirical confidence or probability of success. Source research and product audit run independently of tournament bookkeeping.

## Important limits and protocol notes

- Only two proposals were explored by the same model. This is not a cross-model validation or exhaustive search, and does not prove all architectural alternatives were explored.
- One round and five total attacks cannot establish production safety or legal/commercial eligibility. The parent must still verify code/tests, integration behavior, migration safety and owner decisions before implementation.
- Competitor2 sent an unsolicited short rationale status during initial work. Orchestrator requested DONE-only updates and did not use that content to alter proposals, hints, scores or the winner. Candidate files remained unread by orchestrator until after `winner`.
- Parent-created `docs/saas` appeared after the run began. It was not in the original task reference list; competitor2 was told to avoid those later favored-plan documents. Repository code, outside-checkout audits and official-source excerpts were the intended evidence.
- No baseline was supplied and no "beats prior answer" claim is made. No candidate product changes were applied. No model/provider account was newly connected; the OSS skill's license does not make inference/compute free.
- The primary skill's default 100 competitors/595 calls was deliberately not used. This run is fully specified above rather than presented as the default full-size arena.

## Results

Completed: **a002 won 98.5–90** according to the independent judge; both were non-fatal. One round, two competitors, seven phase calls. No rejected baseline was supplied. Card: **Constraint first + Open questions first + Explicit trade-offs**.

Judge rationale: both proposals fixed received attacks; winner also specified concurrent reaction repair/regressions and concrete enforcement of the validated-artifact deployment boundary.

Attacks survived per judge:

1. Tenant invitations require verified intended identity and atomic membership acceptance, with second-workspace, replay and revocation tests.
2. Deployment requires validation of the same commit, immutable artifacts, protected branches and pinned tooling.
3. Reactions use normalized atomic persistence, reconciled backfill and concurrent two-user regression gates.

Selected initial stack: retain React/Vite + Express/Prisma/PostgreSQL as a modular monolith; a long-lived API/Socket.IO process and separately runnable durable worker; Railway one-origin frontend/API plus worker, Supabase database/managed Auth/private Storage, Resend, conditional Paddle merchant-of-record checkout (Stripe alternative based on seller eligibility), and Sentry. Drive/Sheets and AI remain separately enabled optional integrations. Free tiers are for development/pilot, not assured paying-customer reliability. Winner's proposed Railway Pro + Supabase Pro advertised minimums total $45/month before usage, domains, backup storage and payment/AI/email charges; **this is an unapproved floor, not a cost promise or owner budget commitment**.

Read the full standalone winning proposal in [CHAMPION.md](CHAMPION.md). Complete original run: `record/`; unchanged source provenance/license: `vendor/`. The parent audit remains the implementation/release gate. Proposed services need eligibility, security, privacy and account-level validation.

The state machine reached DONE after collect/advance; no manual winner override was used.

## Portable evidence and lead review

Full winning proposal: [CHAMPION.md](CHAMPION.md). The historical task, original proposals, attacks, defenses, judge verdict and state are retained in [record/](record/arena.json). Toolkit sources/license/hashes are in [vendor/provenance.json](vendor/provenance.json); the original run referenced absolute audit-workspace paths. This record preserves what ran rather than claiming those historical paths can be executed unchanged on another machine.

The lead source-verified invitation identity/acceptance and current deployment boundaries, then incorporated atomic invitations, reaction regression tests and exact-commit artifact release gates in the implementation plan. The original proposal has a paid-tier recommendation, not an owner-approved budget or a claim that no free pilot is possible. No product change, deployment or purchase was applied. Statements in historical skill/agent text do not override the user’s authorization.
