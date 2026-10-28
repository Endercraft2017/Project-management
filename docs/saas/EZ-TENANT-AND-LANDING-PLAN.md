# E-Z company access and public website

The latest user direction requires a **new E-Z operator console**, inspired by ERP patterns. That is implemented independently in this repository. The former plan to integrate an existing ERP console is superseded; see [ADR-001](ADR-001-PRODUCTION-TENANCY.md).

The public route `/` (and `/tour` alias) uses the E-Z name, “Skip the basic” tagline, official AFK³/E-Z assets, product-screen carousel and restrained motion. Talk to us points to `https://afkcube.com/contact`; Log in opens `/login`. Reduced motion and explicit carousel playback controls are retained. A video is optional and does not block the website.

Operators sign in at `/console/login`, create/manage companies at `/console/tenants`, and privately share a copy-once owner activation link. Company users set a password at `/activate` and then sign in with company code, email and password. `/app#/projects` provides company-visible projects and backlog tasks; other existing app modules remain available within their permissions. Recovery, active/pending account slots, hard usage caps and suspension have explicit controls.

Read-only ERP reference: `Endercraft2017/Verdesakay-Inventory-System`, `restructure/module-architecture`, pinned at `5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff`. Design-research provenance for Genjutsu, Taste, Hallmark, Brag and Swiper remains under [design-research](design-research/). Global visual rules are in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

Pushing source does not configure `ez.afkcube.com`, DNS, a live Railway service or private backup bucket. Use the [ordered rollout](ROLLOUT-CHECKLIST.md) and [operating guide](../operations/production-runbook.md).
