# Owner decisions, selected 2026-10-28

## Accepted choices

This table overrides the proposed defaults below and conflicting historical Arena recommendations. It records direction, not implemented controls.

| ID | Owner selection | Consequence |
|---|---|---|
| D1 C | Full scope, including chat, notes, updates, Gantt and advanced reports. | Keep every product module in the phased backlog, except connectors excluded by D8. |
| D2 B | Projects visible to workspace members by default. | Users can join multiple workspaces. This never grants cross-tenant/public access or overrides private conversation/personal-note rules. |
| D3 B + tenant code | Primary login: tenant code, email and password, patterned on the ERP. | Code selects the tenant; identity plus active membership grants access. Previously selected Google remains an optional identity path requiring tenant binding, never Drive consent. |
| D4 B | Existing app data is disposable; reset permitted. | A clean schema/reset is allowed for identified app test data when needed. No reset executed in this update; unrelated stores are excluded. |
| D5 custom | Philippines business; PH, US, UK, EU and other applicable markets. Railway primary data plus bucket backup. | PostgreSQL remains source of truth. Choose region/provider using actual residency/transfer needs and free limits. Seller/payment eligibility requires PH support. |
| D6 A | $0 development/limited pilot. | No purchases, paid upgrades or automatic overages. Stop at free quotas; no always-on production or unlimited inference promise. |
| D7 B | Free tier plus per-active-member plans; AI and storage capped. | Server-side entitlements and atomic usage reservations. Exact prices, numeric quotas and payment eligibility remain open. |
| D8 custom | AI with limits; no Google Drive/Sheets integration. | Basic Google login stays. AI is optional at boot; remote calls stay off until usable free allowance/provider and numeric limits are configured. |
| D9 C, clarified | E-Z; tagline “Skip the basic”; long form “skip the basic choices.” | Public root at ez.afkcube.com: actual-app screen carousel, motion, Talk to us and Log in. Use official AFK³/E-Z brand assets. Video is optional. |
| D10 A | Email support; 30-day deletion recovery; daily backups/seven copies; one-business-day restore target. | Implement retention, encrypted backups and restore drills; these are targets, not verified SLAs. Support owner/calendar remain open. |

The 30-day deletion-recovery window and seven daily backup copies are separate retention targets. Seven backup copies alone cannot supply 30 days of deleted-item recovery; implementation must define a compatible soft-delete/retention mechanism and verify that behavior before making the promise to customers.

Remaining: numeric caps/prices, provider accounts/regions, support owner and the authoritative deployed ERP console/service binding. Tenant-code login and shared-console product provisioning are planned, not enabled by a form alone. Source review is pinned to ERP restructure/module-architecture at 5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff. Secrets belong in secure settings, not chat.

## Historical proposal (superseded where selections above differ)

These are the business/product choices needed for the full SaaS. The audit does not infer incorporation, budget, customer promises or permission policy from your timezone or the existing internal company domain. Answer by ID; a short combined reply is enough. Technical defects in Phase 0 can be fixed independently of most choices.

| ID | Decision | Recommended starting point | What it affects / when required |
|---|---|---|---|
| D1 | Who is the initial customer and what is the smallest paid value? Keep chat, Gantt, updates, Google sync and AI in first release? | Small teams; projects/tasks/sprints + invitations first. Defer optional Google/AI and any collaboration module that is not essential to the pilot. Preserve existing data/features until a deliberate migration decision. | MVP scope before Phases 4–5; avoid rebuilding unused features. |
| D2 | Workspace visibility and roles: can one person belong to several companies? Are projects/tasks private? Need client/guest access? Who can create a workspace? | Many workspaces per person; owner/admin/member roles; invite-based membership; private-by-default projects unless explicitly shared. Defer guests if unnecessary. | Tenant/policy model before schema/permission implementation. Do not broaden current user-private task visibility silently. |
| D3 | How should customers sign in? | Managed identity with verified email/password or passwordless if desired, plus optional Google sign-in. Drive connection is separate. One platform Google app, no tenant credentials for ordinary login. Choose provider after retention/region/cost needs are confirmed. | Provider and recovery flow before Phase 4; actual credentials/domains configured securely. |
| D4 | Is existing data disposable test data or real team/customer content? Must all of it be preserved? Can there be a maintenance window? | Preserve everything; map the current organization to one legacy workspace after inventory, with a tested backup/restore and controlled cutover. | Required before production migration; never assume permission to reset or delete. |
| D5 | Where is the selling business legally based, where are customers, and what data/residency constraints apply? Any health, financial, children's or other regulated data? | General business collaboration only initially; disclose vendors/data flows and choose one supported region. No compliance certification assumed. | Auth/data hosting, payment eligibility, legal/privacy and enterprise scope. Manila client timezone does not answer seller country. |
| D6 | Is zero monthly spend a hard limit for development only, or also for production? What monthly budget/overage ceiling is acceptable? | Use free/local tiers for development and a limited pilot; approve a small capped budget for reliable production compute/backups when launch requirements exceed free plans. Domain and transaction fees remain separate. | Deployment/worker/storage/backups before pilot launch. A free-tier demo cannot imply an uptime guarantee. |
| D7 | How will plans work: free plan, trial, per-workspace/per-seat/usage pricing? What initial limits/refund/cancellation rules? | Keep pricing uncommitted until pilot usage; meter seats/storage and disable unbudgeted AI. Choose Stripe/Paddle or another eligible provider after seller-country and tax-responsibility checks. | Commercial contracts and billing before charging customers. Free software does not eliminate payment fees/tax obligations. |
| D8 | Should AI summaries or Google Drive/Sheets be included, and may customer data be sent to those providers? | Optional opt-in connectors with minimum scopes; AI off by default and outside core startup. No automatic employee-impact decisions from AI ratings. | Provider review, consent/privacy, cost caps and optional feature scope. Current drive.readonly scope adds verification implications beyond simple Google sign-in. |
| D9 | Product name/brand and visual direction? Initial language/timezone needs? | One restrained global design system, accessible opaque work surfaces, light/dark themes, English first with locale/timezone-safe architecture. Reuse existing accents pending branding. | Branding/templates/representative-screen review; shared primitives can proceed now. |
| D10 | Data retention/export/deletion promises, recovery objectives and support owner/channel? | Define explicit backup retention and rehearse restore before promising recovery; support email + incident owner; data export/deletion with a documented retention window. Privacy-preserving analytics only if approved. | Operations/privacy gates before public pilot; numeric RPO/RTO and deletion SLA need an owner commitment. |

## Decisions already supported by the request

- Use free/open-source tooling and services with useful free tiers where they meet requirements; compare commercial limitations honestly.
- Audit and plan before broad restructuring; implement in order with parallel work inside stable boundaries.
- One global design system and one architecture contract across agents.
- Lead review precedes agent commits/pushes. Use feature branches; production deployment is a separate release action.

## Work that does not need business answers first

Repair the proven authorization bypasses, scoped broadcasts, broken lint/CI and optional-provider startup coupling; add real regression tests; review dependency advisories and remove false-success email/logging behavior. These are Phase 0 tasks and do not require a billing price, brand name or cloud account selection.
