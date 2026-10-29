# Operator authenticator protection

Implemented and reviewed 2026-10-29. This protects the standalone E-Z operator principal; it does not change company passwords or introduce Google OAuth. Enrollment is optional. Once enabled for an operator, password-only login cannot grant console authority.

## Configuration and key custody

Supply a dedicated random 32-byte key as **64 hexadecimal characters** in `CONSOLE_MFA_ENCRYPTION_KEY`. Preserve an existing key. Do not reuse session secrets, commit a value or paste one in chat. Keep an independently protected copy in the operational secret manager for restore. Replacing the key without a reviewed decrypt/re-encrypt migration locks out enabled operators: both authenticator and recovery verification fail closed when ciphertext cannot authenticate. An environment-variable change is not a key-rotation migration.

The control-plane `operator_mfa` table stores AES-256-GCM ciphertext with a new random nonce for each encryption and authenticated binding to the operator ID. Recovery codes are random 128-bit values stored only as SHA-256 hashes. The encryption key is not in the table. Database backup and independent key custody are both required for recovery. No external security audit or independently tested disaster-recovery procedure is implied.

## Operator flow

In `/console/tenants`, open **Authenticator protection**. Re-enter the current password, add the displayed key to a standard time-based authenticator (6 digits, 30-second period), then confirm a code within ten minutes. No external QR-code service receives the secret. The browser keeps the key only in component memory; canceling or completing setup removes it from the page.

Confirmation enables MFA, increments the operator session version, signs out other operator sessions and regenerates this session. Save the ten one-use recovery codes in a trusted password manager or secure offline location separate from the authenticator. They are shown once, not persisted in browser storage. If current-session renewal fails after enablement commits, the page retains the codes until acknowledged, then requests sign-in. Do not assume protection was rolled back.

On subsequent sign-in, password verification creates a five-minute pending session without operator authority. A valid authenticator or unused recovery code completes sign-in and regenerates the session. Recovery codes still require the password step. Row locking enforces single use across concurrent requests. Authenticator counters only move forward; a code used for enrollment or sign-in cannot be reused. Wait for the next code before another sensitive action.

Disabling MFA requires the current password and a fresh authenticator or unused recovery code. It clears encrypted enrollment material/recovery hashes, increments the session version and revokes other sessions. Lost-password recovery, additional-operator administration and enforced enrollment remain separate controls; do not clear operators or set MFA off directly to regain access.

Both IP and operator-account limits allow ten MFA mutations/verification attempts per five minutes. The limiter store is process memory, matching the single API replica. Restart resets counts; multiple replicas require a shared limiter before expansion. MFA is not phishing-resistant and does not replace password hygiene, alerting or an independent recovery owner.

## Research and verification

- Exact dependency: `otpauth@9.5.2`, MIT, [official pinned source](https://github.com/hectorm/otpauth/tree/v9.5.2). npm metadata and lockfile integrity checked. Its [README](https://github.com/hectorm/otpauth/blob/v9.5.2/README.md) recommends random secrets, a small validation window, throttling and counter tracking. E-Z uses 160-bit secrets and one-step clock drift. Its [security policy](https://github.com/hectorm/otpauth/blob/v9.5.2/SECURITY.md) describes private vulnerability reporting; it is not an external audit.
- Four unit tests cover operator-bound authenticated encryption, tamper/wrong-key/missing-key failures, TOTP counters/replay and recovery-code normalization.
- `node --env-file=<private-test-env> node_modules/tsx/dist/cli.mjs scripts/operator-mfa-smoke.ts` accepts only guarded loopback `TEST_DATABASE_URL` ending `_test`, creates/removes a random sibling DB. Eight real PostgreSQL/HTTP checks cover proof/enrollment, cookie/version revocation, pending-session isolation, TOTP and recovery sign-in, replay/concurrency, stale versions, missing/replaced keys, disablement and account throttling across IPs. No production operator or provider is used.
- Five frontend tests cover the login challenge, setup-key clearing, one-time recovery-code display, committed enablement with session-renewal failure, incorrect password and unavailable-key messaging. Existing access tests also pass.
