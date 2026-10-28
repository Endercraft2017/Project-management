# E-Z production candidate

The `production` branch adds a standalone E-Z operator console and tenant-code/email/password access. Each company has its own PostgreSQL schema and local accounts. It does not depend on an existing ERP console. The current architecture is defined in [ADR-001](ADR-001-PRODUCTION-TENANCY.md).

Start with the [ordered rollout checklist](ROLLOUT-CHECKLIST.md), [operating guide](../operations/production-runbook.md), [decision register](DECISIONS.md), and [verification report](VERIFICATION.md). Shared visual rules are in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). The root [README](../../README.md) provides reproducible local setup without Google, SMTP or AI credentials.

The candidate implements operator provisioning/suspension/recovery, isolated password sessions, projects/backlog tasks, guarded realtime/files, hard usage reservations, a durable worker, bounded asynchronous AI admission, and encrypted backup/restore tools. Development and pilot spending remain capped at $0; provider activation, paid subscriptions, off-site schedules and public deployment are separate gates.

The uploaded `production-audit-guide.md` was treated as an audit reference. Its 233 checks and original dispositions remain in [CHECKLIST.csv](CHECKLIST.csv); they have not all been marked passed. Original findings, source research, Arena comparisons and design-tool provenance remain evidence. Historical plans under [history](history/) describe earlier proposals and cannot override the current ADR or the user's selected decisions.

This branch is a reviewable implementation candidate, not a certification that every handbook control or commercial launch requirement has been completed.
