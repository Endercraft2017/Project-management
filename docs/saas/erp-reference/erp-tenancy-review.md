# ERP tenant-pattern review for E-Z

Reviewed 2026-10-28. Reference: `Endercraft2017/Verdesakay-Inventory-System`, branch `restructure/module-architecture`, commit **`5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff`**. [Pinned source](https://github.com/Endercraft2017/Verdesakay-Inventory-System/tree/5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff). Local checkout: `/tmp/ez-erp-reference`.

Scope: read-only code/test inspection. No ERP app/scripts/tests were executed; no production API calls, secret/config values or customer records were read. AGENTS.md was read; its ERP-specific Sites/UI workflow does not authorize publishing E-Z or changing ERP. Security details are in `erp-security-review.md`.

## Recommendation

Reuse company-code entry and the **existing operator console direction**, rather than building a second console by default. The ERP is not currently a shared identity/control-plane API for other products. Add a product integration contract before its console governs E-Z. Do not transplant its SQLite data layer or browser bearer-token sessions.

E-Z remains shared Railway PostgreSQL. Company code selects a workspace; authenticated identity plus active membership and product grant authorize access. Accepted D2: projects visible to workspace members by default; users may belong to multiple workspaces. Private conversations and notes stay private. Company code is not a secret, password, invitation or membership proof.

## Source inventory

| Concern | Actual reference evidence | Transfer to E-Z |
|---|---|---|
| Company ID | `src/platform/platform.ts:148-175` allocates immutable first-letter/four-digit/last-letter IDs, case-insensitive lookup; `:239-252` savepoint allocation. | Familiar entry format. One authoritative allocator if codes are shared across products; never independent conflicting E-Z IDs. |
| Sign-in | `website/index.html:64`, `website/app.js:41-51`: Company ID + **username**, password. `src/app.ts:207-223` resolves company, rejects suspended/purged generically, enters regular auth. | It is not email/password or code-only login. Adapt to E-Z's selected global verified-email identity and Google login. |
| Password/MFA | `src/core/auth.routes.ts:45-72` tenant-local username lookup, active/temporary-password expiry, bcrypt and MFA; `:76-105` session response. | Reuse authentication invariants, not tenant-local users/schema/session transport. |
| DB tenancy | `src/shared/db.ts:7-10,34-53`: SQLite file per tenant, AsyncLocalStorage carrying DB; `:258-310` open/migrate/seed; `:328-343` implicit DB proxy/default fallback. | Isolation is primarily physical DB separation. Copying routing alone into shared Postgres provides no data isolation. |
| Resolution/context | `src/platform/tenant-path.ts:6-19` explicit path host; `platform.ts:327-350` subdomain/dev overrides; `app.ts:243-296` catalog lifecycle checks before context. `shared/request-context.ts:1-22` restores ALS lost through Multer. | Resolve before use cases, pass explicit validated TenantContext; missing context must deny. Preserve callback/job/socket context explicitly. |
| Lifecycle | `app.ts:255-290` rejects suspended/purged; unpaid only auth/billing/support; past_due/trial-expired read-only. `platform/provisioning.ts:129-151` suspend/resume/purge/log. | Separate organization-wide versus product-specific hold. E-Z 30-day recovery forbids blindly copying immediate purge. |
| Console | `platform.ts:98-112` separate operator/session tables; `platform-users.ts:54-67` operator authentication; `app.ts:229-240,456-474` console host/flag; `platform.routes.ts:59-88` tenant-context rejection then operator auth. | Keep operator authority separate from tenant admin. Host routing is not the authorization boundary; separate principal/session audience/policy is. |
| Provisioning | `platform.routes.ts:392-422` calls createTenant; `provisioning.ts:48-56` creates catalog then local SQLite DB/admin. | Cannot provision E-Z PostgreSQL or grant another product. Add durable idempotent product adapter. |
| Console scope | `platform.routes.ts:334` SQLite DB export; `:470-540` single plan/modules/status; `:543-550` purge; `shared/modules.ts:24-35` ERP modules, no product model. | It is an ERP console today, not generic multi-product infrastructure. Do not model E-Z as an unrelated inventory feature toggle. |
| Browser storage | `website/app.js:64-71` returns bearer and stores in tenant-scoped local/sessionStorage. | Preserve E-Z PostgreSQL-backed HttpOnly secure cookie sessions. Do not copy browser-readable bearer or URL socket tokens. |
| Workspace view | `platform/tenant.routes.ts:15-44` code/name/plan/state/modules/privileged usage. | Adapt contract to E-Z active-member and capped AI/storage semantics, without exposing task/chat/note content. |

Existing tests inspected, **not run**: `tests/company-login.test.ts`, `tenant-path.test.ts`, `tenant-browser-context.test.ts`, `upload-tenant-context.test.ts`, `platform-console.test.ts`, `platform-console-off.test.ts`. These are intended scenarios to port, not proof of runtime readiness.

## Reuse, adapt, reject

**Reuse:** company-code UX and permanent identifier; operator/tenant separation; lifecycle gates before business handlers; deliberate recovery; provisioning audit; two-company, wrong-identity, suspension and browser-context test scenarios.

**Adapt:** tenant-local username to global E-Z email identity + Membership; separate SQLite databases to tenantId/composite FKs/scoped repositories in shared Postgres; ERP plans to product grants/active-member quotas; local provisioning to durable idempotent commands; raw SQLite export to scoped E-Z export; status edits to explicit product/company commands.

**Reject for E-Z:** default-customer fallback (`shared/db.ts:330`); unknown/default entitlement allow-all (`shared/modules.ts:73-76`); tenant selected by query/header without membership proof; direct shared filesystem DB; shared cookie domain across products; localStorage bearer; code/domain-based automatic enrollment; operator-chosen permanent customer passwords; copying ERP production users/secrets; broadening private chat/notes under D2; migrations on normal requests; immediate purge contrary to D10. These are transferability judgments, not claims that every legacy ERP assumption is universally wrong.

## One console with product adapters

Preferred target:

```
Existing operator console
  → authoritative organization directory + permanent company ID
  → organization/product grants (erp | ez, plan/status/revision)
  → durable provisioning outbox
  → authenticated versioned E-Z management API
      → PostgreSQL tenant projection + memberships/provisioning state
      → E-Z runtime identity + membership + lifecycle/resource policies
```

ERP may keep its SQLite tenant databases while E-Z keeps shared Postgres. Sharing organization identity does not require sharing customer databases, passwords, session cookies or deployments.

### Concrete blockers

1. `TenantRow` (`platform.ts:49-70`) has one ERP plan/status/modules and numeric row ID, not issuer-qualified global organization ID or per-product grants. Add a stable global ID or bridge `(platformIssuer, platformTenantId)` explicitly.
2. Code allocation/lookup is direct SQLite (`platform.ts:149-175`); no authenticated external directory/sync API exists. Never scrape the console or mount its DB into E-Z.
3. Provisioning opens the ERP DB (`provisioning.ts:48-56`); no E-Z service auth, provisioning endpoint, acknowledgement, versioning/replay policy or reconciliation exists.
4. Console CRUD/usage/backups depend on ERP schemas/DB files. Add product selection, E-Z aggregate usage and product-specific status. A company hold and E-Z-only hold are different operations.
5. Separate platform operator login is **not** customer SSO. ERP user credentials/sessions live per tenant; shared company codes do not establish shared identity.
6. Current catalog-row-before-DB creation cannot be a cross-service transaction. Use requested→provisioning→active/failed states, unique command IDs, atomic local commits and retry/reconcile.
7. Actual authoritative deployment/catalog/host, operator authority, free allowances and service route are unverified. Read access to a source branch establishes none of these.

These requirements favor extending the existing console, not duplicating it. A synthetic local TenantDirectory adapter can unblock isolation development; label it nonproduction. A manual one-time catalog import without lifecycle synchronization cannot support a claim that console suspension already governs E-Z.

### Minimal service contract

Proposed, not implemented: organization `{issuer, externalOrganizationId, companyCode, displayName, revision}`; product grant `{product:'ez', organizationId, state, planKey, entitlementVersion, effectiveAt}`; command `{commandId, product, organizationId, action, actorOperatorId, reason, issuedAt, expectedRevision}`. Result returns provisioning IDs/status, never password/hash or customer DB content. Usage is aggregate active members/window and AI/storage units.

Use a supported scoped service identity if available; otherwise a securely bound rotated service secret, signed requests, key ID/timestamp/nonce and replay store. Preserve TLS and pin issuer/audience/product/destination. Never forward an operator's bearer as a service credential. Persist validated commands before acting; reject stale revisions/out-of-order events; offer authenticated reconciliation. Explicit `organization.suspend` and `product.ez.suspend` scopes; resume does not clear a different remaining hold.

Use a durable E-Z catalog/grant projection to avoid a remote directory request for every task query, but **never unbounded stale active authorization**. Define revocation SLA and short-lived signed lease or reliable version refresh. On expiry/directory outage deny fresh login and protected access according to the selected availability policy, rather than silently accepting stale permission. Test free-host sleep/cold starts. This synchronization/revocation bound needs an owner decision before live use.

## Exact E-Z authentication seam

Keep global `User` identity and E-Z's cookie sessions. Add Credential/AuthAccount and Membership, not ERP users copied per DB. Proposed boundaries: identity, tenancy, platform-directory adapter and platform-commands. These are planned modules, not current implementation claims.

1. `POST /api/v1/auth/login` accepts `{companyCode,email,password}`. Apply trusted origin/CSRF protections, bounded validation, IP+normalized-login limits and no-store responses. Normalize code/email. Resolve code through directory/projection without a public company-existence disclosure. Generic failures and comparable password-check work avoid trivial enumeration.
2. Verify global E-Z credential/account state, then **active Membership** to that tenant and current organization+E-Z product grant/lifecycle. Company code, matching email domain or invitation alone never grants membership. Never create/join users implicitly from code/domain.
3. Regenerate Express session ID and issue host-scoped HttpOnly/Secure cookie. Serialize minimal stable identity/session metadata. Explicit workspace URL/API context is validated each request; do not let one mutable `activeTenant` field silently switch requests in another browser tab. Pass validated context only to tenant-scoped repositories.
4. Workspace switching lists only active memberships, revalidates tenant, invalidates tenant-keyed caches and changes socket rooms after authorization. D2 grants workspace-visible projects only inside that membership; conversation membership and note ownership remain independent.
5. Basic Google uses one platform-owned E-Z OAuth client, minimal identity scopes, and server-bound state for chosen tenant/return path. Callback verifies provider subject, membership and safe verified linking before the same cookie session. No Drive/Sheets scopes (D8), no domain bootstrap enrollment, no company-code bypass of OAuth state.
6. Password reset/invite tokens are one-use, hashed, expiring and scoped. Generic response, trusted configured URL origin and session/socket revocation on credential change. With missing free email delivery, do not claim an email was sent; implement explicit audited owner recovery until delivery works. No shared preset passwords or credentials in logs/chat.
7. Integration points are current `server/src/auth/passport-config.ts`, `auth/routes.ts`, `auth/middleware.ts`, `middlewares/session.ts` and config initialization. Keep serialization/store behind one identity policy. Optional Google/AI adapters must not block core boot. Adding password auth while leaving global-role/unscoped routes open would increase exposure.

Do not release customer SaaS login until HTTP, files, exports, jobs and Socket.IO pass negative two-tenant tests. A company-code form alone merely places unrelated customers into the existing single-organization data model.

## Ordered implementation and verification

1. Record source commit, reuse boundary and accepted D2/shared Postgres/email+Google/no Drive/$0 choices. Distinguish common company IDs from shared customer SSO.
2. Add company-code schema/context contract and synthetic local directory adapter; then tenant schema/membership/project rules. Keep external customer entry off until isolation is verified. Disposable-data authorization applies only to the identified E-Z test store.
3. Coordinate an ERP change: immutable organization identity + product grants + E-Z provisioning adapter. Preserve ERP migrations/behavior. Lead review covers operator authority, idempotency, secret handling, retries and compatibility. E-Z authenticated management endpoint commits tenant/invite state atomically. This needs reviewed work in both repositories, not changes to this read-only reference checkout.
4. Add E-Z email/password, verification/recovery and basic Google through one cookie-session policy. Owner provisioning uses one-use invite, not operator-selected permanent password. User may join multiple workspaces; membership controls D2 visibility.
5. Implement grant sync/revisions, suspension/session/socket revocation, reconciliation and lease expiry. Test signed commands, duplicate/out-of-order delivery, directory outage and product-versus-company holds. Cross-tab requests must remain correctly scoped.
6. Extend existing console with E-Z product status/plan/usage/provisioning outcomes using its shared UI contracts. Keep customer workspace settings inside E-Z and task/chat/note content outside routine operator directory access. E-Z recoverable deletion is not ERP immediate purge.
7. Pilot gates: two companies; same human in one/both with different roles; same project names; immutable code after rename; wrong-user/right-code; revoked membership; suspended organization vs product; reset/credential changes; two tabs; expired projection; worker crash; file IDs; sockets and private content. Then quota hard stops, backup/restore evidence and baseline accessibility/UX.

No ERP/E-Z integration test ran in this review. Source scenario coverage is not successful live wiring. $0 software/test adapters do not imply free always-on Railway compute, email, bucket retention or cross-service availability; do not purchase, activate overages or promise unlimited tenant provisioning. Seven daily encrypted backups and 30-day deletion recovery are separate mechanisms already required by D10.

## Decisions to accumulate for the owner

- Same real companies/company IDs in both apps, with existing ERP console as authoritative catalog? Recommended yes when companies match, with explicit E-Z product grants.
- Same company code with separate E-Z account, or true shared ERP/E-Z SSO? Recommended immediate scope is shared company code + vetted E-Z identity; shared SSO requires a distinct identity migration. No silent password/session transfer.
- Product-only versus company-wide suspension? Recommend explicit separate commands, product-only unless operator chooses an organization hold.
- Which existing deployment/catalog/host is authoritative and who can approve its changes/service route? Needed before live wiring; local contract/isolation work can proceed.
- Required revocation propagation bound and outage behavior? Prefer documented short lease and fail-closed behavior; reliable always-on operation may exceed $0.

These do not reopen accepted D1–D10 choices or claim new controls are implemented.
