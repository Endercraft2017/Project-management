# Operator console: research and implementation brief

Reviewed 2026-10-29. Scope: E-Z's authenticated platform operator managing company
workspaces. This is a work screen, not a marketing dashboard. Existing E-Z
colors, logo, type and semantic tokens remain authoritative. Tenant and operator
identities, sessions and authorization remain separate.

## Sources and installation

Reference repositories were cloned to `/workspace/design-tools` over HTTPS with
verified TLS. No repository install hook or remote agent setup script was run.
The checkouts provide pinned, inspectable guidance; this is not a claim that a
first-party plugin or every supplied pipeline was installed or executed.

| Source                                                        | Reviewed revision                          | License and useful guidance                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Taste skill](https://github.com/Leonxlnx/taste-skill)        | `12af471f627f866411b4bd785b19646d3672784c` | MIT. App-screen guide: data/jobs inventory, one question per view, compact shell, genuine counts, tables, independent loading/error states, mobile navigation and settings hierarchy.                                                        |
| [Hallmark](https://github.com/Nutlope/hallmark)               | `8f6969f8922caabde9de1784959eae11ddf68073` | MIT. Existing-design inventory, preserving content/wiring and before/after browser review. Newer than the prior audit's `6033bab`; current existing-design scope rules differ.                                                               |
| [Genjutsu](https://github.com/AThevon/genjutsu)               | `1f518a71378b15d423389e546e767cffc86e14c3` | MIT. Previously reviewed interaction contract: immediate focus, short feedback transitions and reduced motion; no cinematic form entrances.                                                                                                  |
| [Shadcn Admin](https://github.com/satnaing/shadcn-admin)      | `e16c87f213a5ba5e45964e9b67c792105ec74d26` | MIT. Read README, users screen/table and settings shell. Search, status filters, sorting, range-aware pagination, labeled navigation, settings separation and focused dialogs. Its demo data/partial Clerk integration are not E-Z features. |
| [Refine](https://github.com/refinedev/refine)                 | `2352eb5b6539e2f39ad9aef652279ad1dcf2c467` | MIT core. Metadata, README and license reviewed. Resource-centric CRUD/provider boundaries; a framework migration is unnecessary for the current small API.                                                                                  |
| [React-admin](https://github.com/marmelab/react-admin)        | `0c33d9c3c27cc4bf97e11f56080c5bfe182f2f2a` | MIT core; Enterprise Edition is separate. README and LICENSE.md reviewed. Search/filter, validation, notifications, permissions and resource navigation; security mutations should still wait for confirmed server results.                  |
| [Arena skill](https://github.com/Jakeschincariol/arena-skill) | `df07b8e518e10cdecd8cd7712d9958b6f396250e` | MIT. Existing architectural tournament under `docs/saas/arena`. This update uses bounded independent alternatives/review, not a claimed new 100-agent tournament.                                                                            |
| [Brag](https://github.com/latent-spaces/brag)                 | `669ab9286aa28b6c3ee30e75f181ee74319d012a` | MIT. README/product-storytelling review. A launch video does not improve operator workflows, so its renderer/video pipeline is outside this scope.                                                                                           |

No template source was copied into product files by this research. Preserve
upstream notices if substantial code is copied later. OSS licenses do not make
optional hosted services or agent inference free.

## Tools actually executed

Taste's zero-dependency app direction generator was inspected before execution.
The app branch reads local JSON, uses seeded selection and writes local output;
it performs no network requests or child-process execution. Output and history
were scoped to `/workspace/design-tools`, not a global agent configuration:

```sh
TASTE_SKILL_HISTORY=/workspace/design-tools/taste-history.json \
node /workspace/design-tools/taste-skill/skills/taste-skill/scripts/draw.mjs \
  --app --kind smb-admin \
  --brief 'E-Z operator console: manage company workspaces, owner access and capped storage and AI usage' \
  --screens list,detail,settings --theme dark --keep palette,type \
  --seed 291026 --out /workspace/design-tools/ez-console-direction --options 3
```

It offered `true-black-flat` and `data-terminal`. The selected flat operational
direction suits occasional tenant-management decisions better than an always-on
monitoring terminal. A full sheet ran with `--style true-black-flat` instead of
`--options 3`. Evidence: `/workspace/design-tools/ez-console-direction.txt` and
`/workspace/design-tools/ez-console-direction/direction.json`.

This is a guidance adaptation: E-Z's established palette, type and semantic
controls override the sheet's subjective palette bans/exact default shades. The
useful choices are flat hierarchy, compact labeled navigation, a list-first
composition, focused details and restrained feedback. No fictitious chart or
telemetry is justified by a template.

The real accessibility scanner `@axe-core/playwright@4.14.0` was installed using
`npm install --workspace=client --save-dev --save-exact --ignore-scripts`; the
product manifest and lockfile make browser auditing reproducible. Source:
[dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm), package Git
revision `2375f7f5523a2accaeef91a3cb12e30a46e7fbea`, MPL-2.0. The axe engine is
4.14.0. Its adapter injects the local engine into a supplied Playwright page;
there is no required hosted API/subscription. Install scripts/browser downloads
were disabled.

An operational smoke ran in installed Chromium with WCAG2 A/AA and WCAG2.1 A/AA
tags, finding zero violations on a minimal labeled-form fixture. This proves the
tool runs; it is **not** an E-Z accessibility result. The console needs scans of
its authenticated fixture states. Use explicit `browser.newContext()` and
`context.newPage()`; the adapter needs an auxiliary page. Axe detects a subset of
issues, so keyboard, focus, dialog dismissal and responsive review still matter.

Taste's inspector was examined: custom CDP, disposable Chrome profiles, local
probes and screenshots/reports, without built-in E-Z session injection.
Playwright plus axe fits this authenticated console better. No Taste inspector
score or full Hallmark pipeline is claimed.

## Data and jobs inventory

1. Operators manage independent companies, not a tenant's projects/tasks.
2. Identity is company name plus immutable server-generated code.
3. Lifecycle is ACTIVE, SUSPENDED, PROVISIONING or FAILED.
4. Owner contact fields do not establish completed account activation.
5. Storage exposes bytes used and a byte cap, formatted as MiB.
6. AI exposes tokens used and cumulative allowance, without monthly reset.
7. Account slots are a configured cap, not active-seat usage or billing.
8. Creation returns an owner link once, with expiry and no-email warnings.
9. Recovery invalidates old links, needs fresh auth and an ACTIVE company.
10. Audit is a recent bounded feed, not a complete compliance export.
11. Password/MFA settings belong to the signed-in operator.
12. The API lists at most 500 companies; client filtering/pagination must describe the loaded dataset honestly.

Workspaces asks **“Which company needs attention, and what can I do next?”**;
activity asks **“What recently changed?”**; security asks **“How do I protect my
operator account?”**; company detail asks **“What access and limits does this
company currently have?”**.

## Feature priorities within the existing API

| Priority | Improvement                                                            | Purpose and boundary                                                                                                              |
| -------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Now      | Separate workspaces, activity and account-security views               | Removes the long page of unrelated create forms, per-row forms, password, MFA and audit. Preserve drafts on local view switches.  |
| Now      | Focused Create company action/form with progressive quota settings     | Onboarding stays available without dominating every visit. Explain generated code, activation and secure sharing.                 |
| Now      | Search name/code/owner, lifecycle filter and sort                      | Useful management as the company list grows; no unsupported global user/project search.                                           |
| Now      | Result count, range and paging when needed                             | Filter/sort before paging, clamp invalid pages, distinguish empty account from no matches; disclose the listing cap when reached. |
| Now      | Focused company details and quota editing                              | Group identity, owner and limits; accessible dialogs and dirty-form protection; name the affected company in actions.             |
| Now      | Suspend/resume and owner-reset confirmations                           | State consequences, support cancellation and wait for confirmed server results.                                                   |
| Now      | Genuine status counts and storage/token usage                          | Derive from returned data; explicit zero/disabled/over-cap states; no fake revenue/growth or seat-utilization meters.             |
| Now      | Readable, scoped audit activity                                        | Resolve available names/codes; safe fallback for unknown actions; meaningful timestamps; never render arbitrary detail HTML.      |
| Now      | Responsive navigation and useful narrow rows                           | Keep identity/action visible without whole-page horizontal scroll or stacked per-row forms.                                       |
| Now      | Independent loading, stale-data, empty and error states                | Audit failure must not hide a successful company list; refresh preserves usable values and their freshness.                       |
| Later    | Operator roles, richer diagnostics and user administration             | Requires backend authorization and scoped APIs; hiding buttons is not a permission model.                                         |
| Later    | Billing, impersonation, automated mail, deletion and full audit export | Requires separate contracts, providers and reviewed data/security semantics. Avoid inert controls implying these exist.           |

## Alternatives and review gates

A restyled long page has low churn but leaves navigation, accidental-action and
scaling problems. Full Refine/React-admin adoption introduces another
router/data-provider/theme integration for custom sessions and a small API. The
preferred middle path retains React/Vite/Radix, adds coherent operator views and
borrows proven patterns rather than replacing the framework.

Acceptance evidence should cover desktop/tablet/phone, keyboard, search/filter/
sort/page, creation and one-time links, quota validation, lifecycle/recovery
confirmation and cancellation, failures/stale sessions, password/MFA preservation
and axe scans. Label fixture data as tests; do not create production companies
for populated screenshots. Preserve the working API boundaries and controls.

## Delivered and verified

Implemented in the existing console without replacing its API or session model:

- Responsive Workspaces / Activity / Account security shell, sharing E-Z tokens.
- Search, lifecycle filter, sorting and ten-company pages over the loaded directory.
- Company identity, owner and genuine storage/AI usage in a focused details view.
- Creation dialog with optional allowance settings and preserved drafts.
- Explicit company-scoped suspension, resume and owner-reset confirmations.
- Unsaved limit-edit discard protection; confirmation cancellation preserves edits.
- One-use owner links remain in memory and survive local console navigation.
- Separate company/activity failures; security stays available when either list fails.
- Password visibility control; navigation disabled during password/MFA writes;
  unsent security drafts survive local view switches.

Validation on 2026-10-29: client typecheck, strict client lint, production client
build, 89 component tests across 18 files, six Playwright console scenarios, and
one real PostgreSQL/session/company-activation/tenant-isolation browser journey
passed. The real-data test used an owned disposable loopback database; no
production companies were created for screenshots. Automated axe checks found
no tagged WCAG A/AA violations in the exercised directory, activity, security,
creation, detail, suspension-confirmation and discard-confirmation states at
selected 1440/768/360px widths. This describes tested states, not a certification.
Existing dependency build warnings remain; the dependency audit retains seven
low advisories and no moderate/high/critical advisories from this tool addition.

Reproduce the console fixture and accessibility checks with:

```sh
npm run test:tour --workspace=client -- operator-console.pw.ts
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an existing system Chromium.
The separate real API journey requires a dedicated local `_test` database and
is run through `npm run test:browser --workspace=server`; see the production
runbook's isolation requirements. Fixture screenshots are clearly test data.
