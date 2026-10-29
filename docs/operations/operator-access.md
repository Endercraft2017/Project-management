# Private operator setup and account security

The E-Z operator is separate from company administrators. Login is `/console/login`, management `/console/tenants`, initial activation `/console/activate`. There is no default password, public registration, Google requirement or ERP dependency.

## Create the first operator on Railway

The owner identifies the operator email and display name. Do not infer them from Git authors or a support mailbox. Generate a random 32-byte setup code as 64 lowercase hex. Supply it through protected Railway Variables or CLI stdin, never chat, Git, command arguments, URLs or logs.

Configure these together on the intended API service:

| Variable | Value |
|---|---|
| `OPERATOR_BOOTSTRAP_ENABLED` | `true` only for administrative setup |
| `OPERATOR_SETUP_EMAIL` | Owner-selected email |
| `OPERATOR_SETUP_NAME` | Owner-selected display name |
| `OPERATOR_SETUP_CODE` | New private 64-hex code |

Startup acquires the same database lock as stdin bootstrap. It creates an operator only if none exists. The temporary password is random and unknown; only the setup-code SHA-256 is stored, expiring in one hour. Existing accounts/passwords are preserved. Only bounded status is logged; setup values are cleared from process memory. Railway's stored Variables have a separate lifecycle.

After successful provisioning:

1. Open Railway project **E-Z** → **server** → **Variables**, reveal/copy `OPERATOR_SETUP_CODE` privately.
2. Open **https://ez.afkcube.com/console/activate**. Enter selected email, code and chosen password directly. Code is sent in the request body, never the URL. Passwords require at least 12 characters and at most 72 UTF-8 bytes.
3. One-use activation creates no session. Sign in separately at **https://ez.afkcube.com/console/login**.
4. Remove bootstrap flag and all setup variables together. Enabled partial configuration refuses startup. Never delete operators to rerun bootstrap.

Expiry starts at provisioning. A deployment administrator may explicitly set `OPERATOR_SETUP_REISSUE_PENDING=true` with complete setup fields and a **new** code to reissue only an expired, unconsumed initial setup for the same sole pending operator. Password/session version stay unchanged. Unexpired, reused, wrong-identity and consumed requests are refused. Remove the reissue flag with other setup values. Public requests cannot provision or reissue.

The trusted stdin `scripts/bootstrap-operator.ts` remains available with intended database access and also refuses when an operator exists. Do not run both paths concurrently with different identities.

## Authenticator MFA and recovery codes

MFA uses time-based authenticator codes without paid email/SMS providers. Exact-pinned [OTPAuth 9.5.2](https://github.com/hectorm/otpauth/tree/v9.5.2) is MIT. Source/README/integrity review is not a complete external security audit.

Set `CONSOLE_MFA_ENCRYPTION_KEY` to a separate random 32-byte key as 64 hex; preserve an independent secure recovery copy. MFA secrets use AES-256-GCM bound to operator identity. Database backups do not contain the decryption key. Preserve existing keys on redeploy; rotation needs an explicit re-encryption/recovery procedure. Missing/invalid keys never bypass enabled MFA.

Enroll from the signed-in console using your current password. Add the provided secret to a compatible authenticator and confirm its six-digit code. Enrollment is optional; enabled operators must use MFA on later logins. Store displayed one-use recovery codes privately before dismissing them. The server stores hashes and cannot display those codes again.

Password verification for enabled accounts creates only a short pending challenge with no console authority. A second factor completes login and regenerates the session. Transactional locks protect TOTP counters and recovery codes against concurrent reuse. Wait for the next code if the current one was just used to enroll/sign in. IP and account limits are in-memory for the current single API process, not distributed limits for future replicas.

Enabling/disabling increments session version and revokes older sessions. Disabling requires current password plus authenticator/recovery code. Recovery codes are a second factor, not forgotten-password reset. Losing password, key, authenticator and codes requires a separately reviewed deployment-administrator recovery process; no public bypass/master password exists.

Password change revokes other sessions. If an update commits but cookie renewal fails, follow the displayed sign-in instruction; do not assume the update rolled back. Customer credentials/cookies remain separate.

## Validation

Maintained unit tests and `scripts/operator-setup-smoke.ts` / `scripts/operator-mfa-smoke.ts` use guarded newly created local sibling databases. Never target production/customer databases. CI runs them after build. Hosted provisioning, user password selection and authenticator enrollment must be reported as distinct outcomes.
