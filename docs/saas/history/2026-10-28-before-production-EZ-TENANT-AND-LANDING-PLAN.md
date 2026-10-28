> Historical snapshot before the standalone production implementation. Superseded by [ADR-001](../ADR-001-PRODUCTION-TENANCY.md) and the [current rollout checklist](../ROLLOUT-CHECKLIST.md). This is retained evidence, not current setup guidance.

# E-Z landing and ERP tenant alignment

Clarified 2026-10-28: **E-Z — Skip the basic**, long form **skip the basic choices**. Public origin: https://ez.afkcube.com. Philippine business; target markets PH, US, UK, EU and other eligible locations.

## Website and app

`/` is the public landing and `/tour` an alias. Use official E-Z assets, actual app-screen captures with explicit demo-data labels, motion/reduced-motion support, Talk to us (https://afkcube.com/contact) and Log in (`/login`). `/app` retains the existing application. Preserve invitation/query/hash deep links and return successful Google callbacks to `/app` after session save.

Screen captures use real locally rendered components and synthetic GET fixtures; they do not imply working production authentication, tenant isolation, saves or realtime transport. See client/public/screens/provenance.json. No customer data or ERP credentials were copied.

## ERP reuse boundary

Reference [ERP at 5b974e0](https://github.com/Endercraft2017/Verdesakay-Inventory-System/tree/5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff), reviewed read-only. See [tenancy review](../erp-reference/erp-tenancy-review.md) and [security review](../erp-reference/erp-security-review.md) for exact evidence.

Reuse company-code entry and the existing operator-console direction. The reference actually uses company ID + username + password against tenant-local SQLite. E-Z needs tenant code + email + password, active membership and product access in shared Railway PostgreSQL. The code is a public selector, never a password or membership proof.

The current console provisions ERP SQLite stores/modules; it cannot provision E-Z unchanged. Extend it with an authoritative organization/product-grant boundary and E-Z adapter rather than creating a competing console/catalog. Sharing company codes does not share customer databases, passwords, sessions or SSO automatically.

## Proposed contract — not live

1. Map canonical ERP organization ID/company code into an E-Z Workspace projection. Add issuer-qualified organization identity and an `ez` product grant with plan/state/revision. Company-wide and product-only holds are separate.
2. Use authenticated versioned management commands with command ID, organization, product, action, operator/reason and expected revision. Persist receipts; reject replay/stale revisions; retry idempotently and reconcile. Return status/aggregate usage, never customer passwords or task/chat content.
3. Provision workspace and pending owner invitation atomically; enqueue external effects durably. Use one-use verified invitations, not permanent operator-chosen passwords. Failed provisioning must be recoverable.
4. Login normalizes company code/email, verifies identity, membership and company/product status, then regenerates a host-scoped HttpOnly cookie session. Generic failures, throttling and CSRF protections apply. No code/domain auto-enrollment. Optional Google must bind the selected tenant to server-controlled state/PKCE, with no Drive scopes.
5. Require explicit tenant context across HTTP, sockets, jobs, files and exports. No default fallback; cross-tab switching cannot retarget another tab. Use scoped repositories, compound FKs and tested non-owner RLS.
6. Separate tenant admins from operators. Harden console actions with MFA/step-up, narrow scopes and audit. Reject localStorage/query-string bearer transport, shared cookies and immediate purge contrary to recovery policy.
7. Bound directory synchronization/revocation using revisions/leases and reconciliation. Suspension, reset, removal and logout must revoke sessions/sockets/jobs; unlimited stale active grants are unsafe.

No new tenant-code login, provisioning adapter, shared SSO or live console integration is claimed here. Customer entry waits for negative two-tenant tests across every data path.

## Ordered integration

Finish Phase 0 and freeze identity/tenant contracts → add Workspace/Membership/company-code schema/context → separately review ERP product grants/provisioning adapter → implement E-Z email/password/recovery/invites and optional Google → synchronize lifecycle/revocation and expose E-Z in the existing console → test two companies, wrong-code/right-user, multi-membership/tabs, suspension, stale/duplicate commands, worker failure, quotas and restore.

Identified disposable E-Z test data may be reset under the accepted decision; no reset was performed. Future customer data still needs safe migrations and recovery.

## Publishing and remaining bindings

The live domain currently serves an app shell with a root-scoped service worker. Read-only `/registerSW.js` and `/sw.js` inspection shows cached `/index.html` navigation fallback, unlike this older checkout's build setup. Identify the authoritative deployed service/repo/ref and deliberately update its PWA/cache policy before rollout. Do not blindly clear offline data or replace an unrelated deployment.

No Railway/Cloudflare credential binding or Railway CLI is available in this task. Branch publication does not publish the domain. Confirm the real service, CLIENT_URL origin/callback configuration, API/socket/health routes and fresh-versus-installed-client behavior before live rollout. No deployment, DNS edit, paid plan or backup job ran.

Needed before live bridging: authoritative console/catalog URL and operator ownership; confirmation of shared company-code catalog; deployed E-Z service/ref and PWA source; service identity/management route/revocation bound. Numeric quotas, prices, region/support/recovery details remain open. See [PH market notes](../erp-reference/launch-market-notes.md); these do not reopen the accepted brand or markets.
