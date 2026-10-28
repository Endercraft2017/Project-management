# Encrypted backup and restore drill

These scripts make real custom-format `pg_dump` archives and optionally a tar archive of uploads, encrypt each with AES-256-GCM using a random nonce, and authenticate their metadata manifest with HMAC-SHA256. They stream encryption, never leave a plaintext dump in the output directory, verify decryption and `pg_restore --list`, and clean protected temporary verification files. An authenticated archive is still not a successful application restore; run the drill below and compare application data.

No external bucket, provider account, production backup schedule or production restore has been activated. Local tests used synthetic tenant data only. Backup operations can consume storage/egress; configure a budget/retention and independent key escrow before production use.

## Prerequisites

Use matching-compatible PostgreSQL client tools (`pg_dump`/`pg_restore`), Node22+, and Python3.12+ for safe file extraction. Alternatively set `POSTGRES_TOOLS_CONTAINER` to an existing local PostgreSQL-tools container; Docker passes required PG variables by name, never password values on the command line. Container network addresses must actually reach the intended database. The local test used PostgreSQL16.15.

Provide `DATABASE_URL` and a random32-byte key encoded as base64 in `BACKUP_KEY` via secure environment settings. Generate/store that key outside the repository; never print it in logs/chat or save it beside the backups. A lost key means a lost backup. Retain old keys securely when rotating and identify them in the operations inventory. `BACKUP_DIR` defaults to `/workspace/.ez-backups` and must be persistent/private in the real deployment.

```sh
node scripts/backup.mjs
```

To include uploaded files, set `BACKUP_UPLOADS_DIR` to the real private upload root. **Pause API and worker writes first**, then set `BACKUP_WRITES_PAUSED=true` as confirmation and run backup. The flag does not pause anything itself. A database snapshot and concurrent file copy are not one consistent recovery point without a coordinated write pause. The database archive includes the control-plane tenant-to-schema catalog and all tenant schemas; uploaded objects require their own archive/manifest entry. External object stores not mounted at that root are not implicitly backed up.

The output manifest names encrypted artifacts and checksums only. Until a manifest is written and the command succeeds, an operation is not a verified backup. Capture its exit status and monitor failures. `pg_dump` roles/ownership/grants are not exported as privileged global roles: restore uses `--no-owner --no-acl`, so reapply approved runtime access/roles/secrets after restoration. PostgreSQL extensions/tool versions and sufficient disk space are deployment prerequisites.

## Optional private bucket copy

Only an explicit `--upload` does outbound storage work. It additionally requires `BACKUP_UPLOAD_ENABLED=true`, `BACKUP_PRIVATE_BUCKET_CONFIRMED=true`, `BACKUP_S3_URI=s3://bucket/private-prefix/` and a configured AWS-compatible CLI identity/endpoint. The script copies **encrypted artifacts and authenticated manifest**, never plaintext or the key:

```sh
node scripts/backup.mjs --upload
```

The confirmation flag is an operator assertion, not an automatic proof of bucket privacy. Verify the real bucket policy/public-access block, least-privilege write identity, TLS endpoint, versioning/immutability, lifecycle retention and a separate restore-reader identity. AWS CLI supports configured S3-compatible endpoints through its normal environment/configuration. Never disable TLS/signature verification to make an upload pass. Downloads must retrieve all artifacts named by the manifest. External upload, provider retention and cross-region recovery are unverified here.

## Verify without restoring

Set `BACKUP_KEY` and a PostgreSQL-tools environment. `--verify-only` validates manifest authentication, ciphertext checksums, full decryption authentication and the custom archive listing. It does not connect to or write an application database:

```sh
node scripts/restore-backup.mjs /private/backup/ez-....manifest.json --verify-only
```

Restore verification needs temporary plaintext disk in a0700directory with0600files and removes it afterwards. This is necessary to authenticate the whole archive before any database side effects. Use a trusted encrypted-volume host and adequate space; process crash or host loss can still require secure temporary-directory cleanup. Do not place temporary data on shared/public storage.

## Restore to a fresh disposable target

Create a new empty PostgreSQL database, preferably named`*_restore_test` or`*_restore_drill`. Supply its URL in `RESTORE_DATABASE_URL` and exact database name in `RESTORE_CONFIRM_DATABASE`. The script refuses any target with existing user tables and never uses `--clean`. With file-bearing backup, also supply an empty `RESTORE_UPLOADS_DIR`.

```sh
node scripts/restore-backup.mjs /private/backup/ez-....manifest.json
```

Restoring a name outside those drill suffixes needs a separate `RESTORE_ALLOW_NONTEST=true` assertion and operational review; this is **not approval to overwrite production**. Keep source and restore database names different. Check host, credentials and target independently. Database restore runs in one transaction, but filesystem restore is separate; a later file extraction failure means an incomplete overall restore. Keep restored services offline until all checks pass.

After restoring, verify tenant catalog/schema mapping, owner/account state, tenant-local counts/record samples, notification state, uploaded file hashes/ownership, usage counters, disabled optional providers, authentication/isolation and a representative project/task/chat flow. Reapply runtime grants and inject secrets separately. Do not start workers blindly from a recovered snapshot: inspect queued/uncertain external work before replay to avoid duplicate messages/charges. Reconcile any writes since the snapshot; a full restore loses newer writes unless recovered separately. Record actual elapsed recovery time and data-loss window rather than claiming an untested RTO/RPO.

## Executed local validation

`TEST_DATABASE_URL` must refer to a disposable local database ending`_test`:

```sh
npx tsx --tsconfig server/tsconfig.json scripts/platform-jobs-smoke.ts
POSTGRES_TOOLS_CONTAINER=servicebay-postgres node scripts/backup-smoke.mjs
```

The quota/jobs script refuses pre-existing tenants and leaves its synthetic tenant data for the backup drill. The backup drill creates/refuses a pre-existing `ez_backup_restore_test`, backs up and restores that synthetic source into the empty target, compares tenant catalogs/usage and tenant notification counts, verifies exact uploaded file content, rejects wrong keys/tampered ciphertext/nonempty restore, then drops its own restore database and deletes temporary artifacts. Source-test database cleanup remains the test operator's job. Six backup assertions and eight quota/jobs checks passed locally; no external backup upload or real provider call occurred.
