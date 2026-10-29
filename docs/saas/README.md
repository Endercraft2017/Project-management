# E-Z production candidate

The `production` branch adds a standalone E-Z operator console and tenant-code/email/password access. Each company has its own PostgreSQL schema and local accounts. It does not depend on an existing ERP console. The current architecture is defined in [ADR-001](ADR-001-PRODUCTION-TENANCY.md).

Start with the [ordered rollout checklist](ROLLOUT-CHECKLIST.md), [operating guide](../operations/production-runbook.md), [decision register](DECISIONS.md), [hosting/provider research](HOSTING-AND-PROVIDERS.md), and [verification report](VERIFICATION.md). Shared visual rules are in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). The root [README](../../README.md) provides reproducible local setup without Google, SMTP or AI credentials.

The candidate implements company provisioning/suspension/owner recovery, isolated password sessions, operator password change, projects/backlog tasks, guarded realtime/files, hard usage reservations, a durable worker, bounded asynchronous AI admission, and encrypted backup/restore tools. The budget instruction remains $0; actual Railway billing limits are not verified. Provider activation, paid subscriptions, durable hosted uploads, off-site schedules and public rollout remain separate gates.

The uploaded `production-audit-guide.md` was treated as an audit reference. Its 233 checks and original dispositions remain in [CHECKLIST.csv](CHECKLIST.csv); they have not all been marked passed. Original findings, source research, Arena comparisons and design-tool provenance remain evidence. Historical plans under [history](history/) describe earlier proposals and cannot override the current ADR or the user's selected decisions.

This branch is a reviewable implementation candidate, not a certification that every handbook control or commercial launch requirement has been completed.
