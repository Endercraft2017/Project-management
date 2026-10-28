# Current handoff

Updated 2026-10-28. Branch: `production`. This is a new standalone E-Z tenant-console implementation; the earlier external ERP console adapter plan is superseded. See [ADR-001](ADR-001-PRODUCTION-TENANCY.md), [verification](VERIFICATION.md), and [ordered rollout](ROLLOUT-CHECKLIST.md).

Implemented: isolated company accounts and schemas; code/email/password access; separate operator sessions; company provisioning, activation, invitations, recovery and suspension; owner/seat protections; company-visible projects; private nested task/read/socket policies; atomic hierarchy/rollups; scoped files and quota accounting; durable reminders and bounded AI generation; encrypted backup/restore tools; tested CI without an automatic deployment step. Core boots without Google/AI/SMTP keys.

The shared browser cookie is checked against a document's pinned sign-in context before protected operations. A changed sign-in shows a reload screen instead of submitting an old company's form into the new session. Console identity remains independent.

The E-Z landing uses official assets and an accessible Swiper screen carousel. Landing, access/console and workspace colors/fonts consume shared brand tokens. Demo screenshots are rendered application fixtures, clearly labeled and distinct from authenticated browser evidence.

Remaining work and owner decisions are collected in [DECISIONS.md](DECISIONS.md). Billing/webhooks/paid entitlements, true operator MFA, a measured capacity/scaling plan, hosted backup schedules, 30-day deleted-item recovery, export/deletion/privacy controls and real provider/account/domain activation remain launch gates. Do not infer production readiness or complete handbook coverage from the local build/tests.

Use current contracts and source, not historical chat or superseded proposals. Maintain one writer for schemas, shared tokens and dependency locks. Review source and test evidence before committing/pushing; do not merge/deploy without the applicable authorization.
