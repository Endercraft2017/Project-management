# Owner decisions, selected 2026-10-28

## Accepted choices

This table overrides the proposed defaults below and conflicting historical Arena recommendations. It records direction, not implemented controls.

| ID | Owner selection | Consequence |
|---|---|---|
| D1 C | Full scope, including chat, notes, updates, Gantt and advanced reports. | Keep every product module in the phased backlog, except connectors excluded by D8. |
| D2 B | Projects visible to workspace members by default. | The same email may have separate tenant-local accounts in multiple companies. This never grants cross-tenant/public access or overrides private conversation/personal-note rules. |
| D3 B + tenant code | Primary login: tenant code, email and password, patterned on the ERP. | Code selects the tenant; the tenant-local account and current active status grant access. Optional basic Google login is deferred; this candidate uses password access and disables all Google routes. |
| D4 B | Existing app data is disposable; reset permitted. | A clean schema/reset is allowed for identified app test data when needed. No reset executed in this update; unrelated stores are excluded. |
| D5 custom | Philippines business; PH, US, UK, EU and other applicable markets. Railway primary data plus bucket backup. | PostgreSQL remains source of truth. Choose region/provider using actual residency/transfer needs and free limits. Seller/payment eligibility requires PH support. |
| D6 A | $0 development/limited pilot. | No purchases, paid upgrades or automatic overages. Stop at free quotas; no always-on production or unlimited inference promise. |
| D7 B | Free tier plus per-active-member plans; AI and storage capped. | Server-side entitlements and atomic usage reservations. Exact prices, numeric quotas and payment eligibility remain open. |
| D8 custom | AI with limits; no Google Drive/Sheets integration. | Google login, Drive and Sheets are disabled in this candidate. AI is optional at boot; remote calls stay off until usable free allowance/provider and numeric limits are configured. |
| D9 C, clarified | E-Z; tagline “Skip the basic”; long form “skip the basic choices.” | Public root at ez.afkcube.com: actual-app screen carousel, motion, Talk to us and Log in. Use official AFK³/E-Z brand assets. Video is optional. |
| D10 A | Email support; 30-day deletion recovery; daily backups/seven copies; one-business-day restore target. | Implement retention, encrypted backups and restore drills; these are targets, not verified SLAs. Support owner/calendar remain open. |

The 30-day deletion-recovery window and seven daily backup copies are separate retention targets. Seven backup copies alone cannot supply 30 days of deleted-item recovery; implementation must define a compatible soft-delete/retention mechanism and verify that behavior before making the promise to customers.

## Remaining decisions, collected for the next phase

No new decisions are needed to review this source branch or run the local console. These choices are needed before activating the associated launch capability:

| Decision | Choices to assess | Current safe default |
|---|---|---|
| Commercial plans | Prices/currencies, what an active billable member means, free/paid caps, billing period, grace/refund/cancellation. | No live billing. Account admission defaults to 10 active/pending slots and is not a billing meter. |
| AI provider/model | Verified free allowance, permitted countries/data use, model quality and numeric per-company allowance. | AI disabled, allowance 0; no paid calls. Existing adapter uses the OpenAI API and is not a promise of free inference. |
| Hosting and residency | Railway plan/credits/hard stop, accepted data region, admitted company count, durable upload mount, worker availability; private backup bucket policy/region. | API observed in Railway `sfo`; core deployed, cost controls unverified. No new paid resources or upload durability claim. Production uploads guarded until verified. |
| Payments | Philippines-eligible provider, merchant approval, checkout currency and settlement/tax handling. | No checkout or paid entitlement claims. |
| Support and recovery | Named support/security owner, support mailbox/calendar, incident response and measured restore responsibilities. | Email-support direction and one-business-day restore target retained; no verified SLA. |
| Retention and privacy | Export/deletion policy, implementation of 30-day deleted-item recovery, backup expiry and cross-border disclosures. | No claim that seven daily backups provide 30-day item recovery. |

Initial development limits are explicit and adjustable by operators: 100 MiB storage, 10 account slots and 0 AI tokens per company. AI token limits are cumulative, with no monthly billing reset implemented. No tenant must obtain Google OAuth credentials for password login.

Research refreshed 2026-10-29: [hosting and provider review](HOSTING-AND-PROVIDERS.md). Railway's published Free credit is $1/month; that does not establish this workspace's allowance or ongoing $0 operation. Paddle is the recommended international payment candidate to assess, subject to approval and owner policy decisions. No current free AI allowance was verified. Operator email/name and secure bootstrap delivery remain operational inputs; do not send passwords in chat.

The operator console decision is settled: build and use the standalone E-Z console in this repository. There is no pending external ERP console binding. The ERP reference was inspected read-only. Credentials belong in secure environment settings, not chat.

Private operator activation, optional authenticator MFA and bounded admin workspace export are now implemented. The immediate owner input is the operator email/display name. Password selection uses the private one-use code at `/console/activate`; no password should be sent in chat. See [operator access](../operations/operator-access.md). Export is a documented workspace snapshot, not a complete personal-data portability/deletion or 30-day recovery implementation.

Historical options and the original numbered question wording remain in [the preserved decision snapshot](history/2026-10-28-before-production-DECISIONS.md).
