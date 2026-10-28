# Production implementation update

The current behavior, validation and limits are in [VERIFICATION.md](VERIFICATION.md) and [WORK-STATE.md](WORK-STATE.md). Follow [ADR-001](ADR-001-PRODUCTION-TENANCY.md) for architecture and [ROLLOUT-CHECKLIST.md](ROLLOUT-CHECKLIST.md) for the remaining sequence.

The operator console is newly built in E-Z. The ERP was reviewed as a read-only reference; no ERP service, credentials, data or runtime console is reused. Existing E-Z public-schema data is not silently assigned to a company. All validation uses synthetic, explicitly owned disposable test fixtures.

The public landing remains `/`, with `/tour` as an alias, Talk to us and Log in links. `/login`, `/activate`, `/console/login`, `/console/tenants` and `/app` implement the access journeys. Basic Google login and Drive/Sheets remain disabled in this candidate; password access needs no Google credentials.

Historical audit and UI-slice reports are preserved under [history](history/). Their earlier pass counts, missing features and architecture choices describe those snapshots, not the current candidate.
