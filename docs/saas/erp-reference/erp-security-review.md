# ERP reference: tenant, login and console security review

Reference checkout: `/tmp/ez-erp-reference`, exact commit `5b974e0e4adfb9011c4539ad0e041f50a3d8a8ff`. Reviewed 2026-10-28. All file:line references below are relative to that checkout at that revision. This is a static, read-only reuse assessment. No ERP application scripts, package installation, migrations, tests, production calls, account logins, credential reads or product changes were executed. Shell tools only read source/metadata. Existing reference tests were inspected as leads, not represented as run.

`AGENTS.md` was read first. Its workflows concern work inside the ERP, including a particular private UI Site; they do not authorize publishing to that Site or changing this product during a read-only reference review. This report stays within the requested tenant/auth/console reuse scope. Backend reviewer owns the wider DB/catalog inventory and adaptation plan.

## Recommendation

**Reuse the ERP's product patterns and selected isolated concepts, not its auth/tenancy implementation wholesale.** It supplies real company-code routing, company lifecycle, password recovery/session management and a separate operator console. The project-management SaaS can implement the same experience in its existing Express/Prisma/PostgreSQL architecture, with global email identities, tenant memberships, HttpOnly cookie sessions, explicit tenant context and distinct tenant-admin/operator permissions.

The reference is not an email/password multi-workspace identity service: its login queries a username in the selected tenant database; email is optional recovery contact. Reusing the UI flow does not prove ownership of a recovery email or allow a person to join multiple tenant accounts safely. Do not replace the current PostgreSQL design with tenant-local SQLite accounts merely to reuse its code.

## Patterns worth adopting

| Pattern | Exact source evidence | Safe adaptation |
|---|---|---|
| Company code as a human-facing selector | `src/platform/platform.ts:148` allocates permanent company IDs; `:173` validates their shape and queries case-insensitively. `src/app.ts:207–223` resolves company before normal login and returns a workspace path. | A company code can select a workspace or guide discovery. It is public/enumerable routing metadata, never a secret, session claim or permission grant. Resolve it to an immutable workspace ID, then authenticate identity and verify membership. |
| Control plane separated from tenant auth | `src/platform/platform-users.ts:54–67,105–138` uses operator sessions in platform storage; `src/platform/platform.routes.ts:88` guards subsequent console routes. `src/platform/platform.ts:29` makes console opt-in; `src/app.ts:229–240` can constrain console to a separate host. | Keep an operator principal/session/audience separate from customer membership. A tenant admin receives only its own workspace settings, members, integrations and plan views. Platform lifecycle actions remain operator-only; a tenant ADMIN flag must never unlock them. Host separation supplements authorization, not replaces it. |
| Opaque, hashed, expiring sessions with revocation | `src/shared/db.ts:4838–4847` generates 32 random bytes and stores SHA-256 digests; `src/shared/auth.ts:52–96` creates/ends sessions and exposes only a public session ID to revocation APIs. `:99–125` checks active status, expiry and current permissions. | Preserve vetted session middleware and the existing cookie security boundary. Add server-side session records/digests, finite lifetime, optional short shared-device lifetime, device/session list and revoke operations. Never expose the stored digest as a usable bearer. |
| Current permission checks | `src/shared/auth.ts:103–124` joins current user/role rather than trusting stale client role. `src/shared/auth.ts:277–291` supplies role/permission middleware. | Central workspace-membership and resource policies, refreshed after role changes. Use one validated actor/resource/tenant context across HTTP, sockets and jobs. This does not remove the need for per-project/task/conversation permissions. |
| Recovery token handling | `src/core/auth.routes.ts:277–280` stores only reset-token hash; `:299–313` checks expiry, atomically consumes the token, invalidates outstanding reset links and ends sessions. `src/app.ts:328–335` defines recovery throttles. | Reuse these invariants, with a transactional PostgreSQL implementation, verified intended email, short deliberate TTL, canonical application URLs, durable mail and no raw-token logging. Return neutral recovery responses. |
| Session management UX | `src/core/auth.routes.ts:178–200` lists caller sessions, revokes others and scopes single-session revocation by user. `src/shared/auth.ts:82–96` implements ownership in the update. | Product account/security page with current device, recent activity and revoke actions; all mutations require session and CSRF protection. Revocation must also evict existing Socket.IO subscriptions. |
| Explicit lifecycle and support boundaries | `src/app.ts:255–290` blocks suspended/purged tenants and constrains past-due writes while allowing recovery/billing/support. `src/platform/support.routes.ts:10–18` requires auth and workspace-management permission. | One documented tenant lifecycle/state machine, including suspension, reactivation, deletion pending and recovery. Apply status across workers/sockets/files as well as HTTP. Keep support records tenant-scoped and minimize what operators can see. |
| Explicit background tenant context | `server.ts:43–63` enumerates eligible tenants and uses `withTenant` for housekeeping/reminders. `src/shared/request-context.ts:13–21` restores context around callback middleware. | Carry validated workspace context in durable job payloads and reopen a scoped unit of work. Test callback/async boundaries and pool reuse. Never use a missing-context fallback to a real customer's workspace. |

## Do not copy without correction

### 1. Browser-readable credentials and URL tokens

`public/js/api.js:11–38` stores a long-lived bearer in localStorage or sessionStorage. `web-console/app.js:40–56` does the same for the powerful platform operator credential. `src/shared/ws.ts:99` reads the session token from the WebSocket URL query. These choices increase credential exposure through page JavaScript, browser storage and URL logging.

**PM adaptation:** keep server-managed `Secure`, `HttpOnly`, scoped cookies, separate operator and tenant cookie audiences/names, CSRF/Origin defenses, and approved same-origin topology. Authenticate Socket.IO from the server session, or issue a narrowly scoped short-lived one-use connection ticket if a different transport is necessary. Do not place permanent session credentials in connection URLs. Native-client requirements, if added later, need their own explicit token/secure-storage design.

### 2. Ambient default tenancy and database-local identity are incompatible with the selected PM model

`src/shared/db.ts:329–336` resolves missing AsyncLocalStorage context to the default database; `src/shared/request-context.ts:4–7` documents an actual callback context-loss case. `src/platform/platform.ts:332–349` accepts test header/query overrides outside production and can fall back to default on an invalid selector. These are compatibility accommodations for the ERP's self-hosted/single-tenant mode, not a safe SaaS default for shared PostgreSQL.

**PM adaptation:** require a workspace context for tenant-owned data, deny invalid/unknown/missing tenant selection, and prohibit customer traffic from selecting a legacy fallback. Resolve global identity first and authorize each selected membership. In PostgreSQL, a process-wide or AsyncLocalStorage label alone does not scope a Prisma query; repositories and optional RLS must enforce it in the same transaction/connection. Raw company codes/headers remain selectors only. Test two tabs in different workspaces and requests that complete after switching workspace.

### 3. Console power must be hardened and split into explicit roles

`src/platform/platform.routes.ts:88` grants every authenticated operator the subsequent platform API; there is no per-operation permission guard in the inspected reset/purge routes. `:289–329` lets an operator reset the first tenant administrator's password; `:543–551` purges a workspace after a typed slug. `tenantOwner` at `:223–226` infers owner from the first admin, not a distinct ownership model. The reviewed operator auth lacks MFA/step-up. A typed slug prevents accidental clicks, not an already authenticated malicious operation.

**PM adaptation:** introduce platform role permissions (read-only support, billing operations, tenant lifecycle/security admin), required MFA or external access controls for operators, recent reauthentication for recovery/suspension/purge, explicit owner membership/last-owner safeguards, action reasons, immutable actor+target audit and notification. Prefer reset invitation links rather than operators knowing permanent customer passwords. Any temporary credential must be one-use/expiring, shown once, never logged, and force change before access. Purge is a staged retention operation with a recovery/deletion policy, not a direct filesystem delete.

### 4. Password implementation and bootstrap paths are inconsistent

`src/platform/platform-users.ts:32–33` accepts six-character operator bootstrap passwords and hashes synchronously at bcrypt cost 10. Its `upsertPlatformUser` updates the hash without revoking existing operator sessions; normal password change at `:82–83` does revoke other sessions. Tenant new-password schema uses 8–128 characters and a common-password list (`src/shared/password-policy.ts:14–33`); login has no small explicit upper bound (`src/shared/validation.ts:51–55`). `src/core/auth.routes.ts:50,249` performs synchronous password comparison/hashing.

**PM adaptation:** use one maintained, vetted password implementation with deliberate current parameters and asynchronous resource-bounded hashing. Prefer modern memory-hard hashing for new identities; if keeping bcrypt, handle its 72-byte input limitation explicitly rather than promising arbitrary 128-character uniqueness. Apply the same policy/max length to creation, CLI bootstrap, admin reset, self reset and change; no hardcoded/default passwords. Password/credential resets should invalidate appropriate sessions/sockets, including CLI/operator reset paths. Add per-IP plus tenant/account throttles with a distributed store when multiple replicas run. An email-password account requires verified email and safe recovery/account linking; ERP username/password is not equivalent.

### 5. Password recovery needs canonical origins and a durable transaction/outbox

The configured-host branch in `src/core/auth.routes.ts:40` is useful, but its fallback uses request `Host` and `x-forwarded-proto` (`:41–42`) to build reset URLs. Neutral response text at `:289` does not by itself prove identical timing. Sending mail with `void sendMail` (`:283`) is not a durable delivery guarantee. Reset consumption and password/session changes at `:306–313` are separate statements rather than one explicitly scoped transaction.

**PM adaptation:** generate links from an approved public base URL, not untrusted host/proxy headers. Atomically consume the valid reset token, update the password, invalidate other reset/session grants and enqueue a safe notification. Send through a durable outbox with status/retry, redact link tokens and test expired/replayed/concurrent resets. Do not claim email delivered merely because a response returned.

### 6. MFA secret storage fails the database-only disclosure boundary when external key is absent

`src/shared/mfa.ts:63–65` encrypts TOTP secrets; `src/shared/secrets.ts:3–25` documents/implements an autogenerated encryption key stored inside the same database when no external secret is configured. Ciphertext plus its key in one compromised database does not provide the intended separation. Tenant privileged MFA policy defaults off (`src/shared/mfa.ts:34–35`), and tenant MFA does not secure platform operators automatically.

**PM adaptation:** managed key/secure runtime key independent of customer DB, startup enforcement when enabling MFA/connectors, versioned key rotation and restore tests. Require operator MFA separately; decide tenant-owner MFA policy explicitly. Reuse challenge expiry, bounded attempts and single-use recovery-code semantics only after isolated review, not the fallback-key design.

### 7. Existing sockets are not automatically reauthorized or revoked

`src/shared/ws.ts:91–106` validates tenant status and token during handshake. Its connection state then carries only slug/user ID; `:117–134` handles typing/heartbeat without session-status revalidation. `broadcast` at `:55–63` sends to stored user connections. Revoking a session in the HTTP auth functions does not call a corresponding socket eviction in these inspected paths.

**PM adaptation:** do not inherit this known class of weakness already found in PM. Keep socket/session association, evict on logout, role/member/status changes and expiry, and reauthorize sensitive event delivery/resource subscription. Heartbeat responsiveness is not authentication freshness. Test an established connection after revocation, not only a rejected new handshake.

### 8. Tenant creation/purge and timers are not a production provisioning job system

`src/platform/provisioning.ts:48–57` creates a catalog row before opening/seeding the tenant database. It is not one transaction across catalog/filesystem; a failure can leave partial setup. The function bypasses the full maximum-password schema on direct calls. `src/platform/signup.routes.ts:39–69` performs create→payment flag→subscription/invoice steps sequentially. `src/platform/provisioning.ts:142–151` marks purged, best-effort deletes files and starts upload removal without awaiting completion. `server.ts:58–65` starts interval tasks in each process.

**PM adaptation:** explicit provisioning states and idempotency keys, transactionally create workspace+owner membership and enqueue jobs, reconcile failures with retry/compensation. Avoid external payment/mail/storage writes inside a DB transaction. Deletion is a durable workflow with confirmed completion/retention and recovery metadata. Keep API and worker separate and use atomic job leases; copying per-process intervals would duplicate effects across replicas.

## Concrete implementation shape for the PM SaaS

1. Retain PostgreSQL/Prisma, global `User` and optional provider `AuthIdentity`, plus `Workspace`, immutable human company code and `Membership` with owner/admin/member permissions. Public `/login` can accept company code + email + password or discover memberships after identity proof. Never let a code decide ownership or auto-join based solely on email domain.
2. Implement password/verified-email authentication through a maintained library/provider adapter or a tightly reviewed framework-backed local identity module. Support current Google users with verified reauthentication/account linking; do not replace or silently duplicate identities. The owner's selected E-Z scope excludes Drive/Sheets; retain only basic Google identity scopes.
3. Add a distinct tenant-admin area for the current workspace's members, settings, quotas, billing and integrations. Extend the existing ERP operator console with product grants and an authenticated E-Z adapter, preserving its distinct principal/session scope and adding least-privilege permissions; do not create a competing console. No customer account can enter operator routes merely by being a tenant owner.
4. Bring over the proven UX semantics: company code, explicit workspace status, security session list, recovery flows, support records, audited lifecycle transitions. Adapt tables and contracts; do not import ERP SQL, SQLite default-fallback proxy, native/offline replay hooks, payroll/stock permissions, localStorage auth or unrestricted operator authority.
5. Preserve a traceability table in implementation PRs: reference revision/path, adopted invariant, PM file/schema/API, changes made, tests and limitations. Verify source-license/ownership before copying substantial implementation; repository access alone does not prove reuse rights.

## Acceptance evidence required before enabling it

- Two workspaces, same global user in both, overlapping local resource identifiers: changing company code/path/header/body never selects an unauthorized membership/resource. Missing tenant context fails closed across query, upload callback and job boundaries.
- Email/password registration/verification, neutral failed login/recovery, bounded login throttles, long/unicode password behavior, single-use/concurrent reset, owner transfer and invite replay/expiry are tested with disposable records.
- Tenant-admin and operator principals cannot cross session audiences/routes. Platform read-only support cannot reset/purge, and customer roles cannot call platform APIs. High-risk actions require step-up and leave immutable audit evidence without credentials.
- Logout, password change/reset, deactivation, removal and tenant suspension immediately affect HTTP and already-connected sockets. Public session listings never contain bearer credentials/digests.
- Provisioning retries produce one workspace/owner and no partial active customer. Deletion/restore are rehearsed; worker retries/replicas do not duplicate external effects. Backup/key-recovery assertions come from actual drills, not implementation names.

These are proposed acceptance checks, not tests executed against the reference. No statement here certifies ERP or PM production security.
