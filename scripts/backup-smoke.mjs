import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const { Client } = createRequire(
  new URL("../server/package.json", import.meta.url),
)("pg");
const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error("TEST_DATABASE_URL required");
const u = new URL(raw);
assert(
  ["postgres:", "postgresql:"].includes(u.protocol) &&
    ["localhost", "127.0.0.1"].includes(u.hostname) &&
    /^[a-z0-9_]+_test$/.test(u.pathname.slice(1)) &&
    !u.hash && [...u.searchParams].length === 0,
);
const destination = new URL(raw);
const restoreDatabase = process.env.BACKUP_SMOKE_RESTORE_DATABASE || "ez_backup_restore_test";
assert(/^[a-z0-9_]+_test$/.test(restoreDatabase), "Restore drill requires a local test database name");
assert.notEqual(restoreDatabase, u.pathname.slice(1), "Source and restore databases must differ");
const ownership = process.env.BACKUP_SMOKE_OWNER;
assert(!ownership || /^ez-operations-smoke:[a-f0-9]{32}$/.test(ownership), "Invalid restore drill ownership marker");
destination.pathname = `/${restoreDatabase}`;
const source = new Client({ connectionString: raw });
await source.connect();
const exists = await source.query(
  "SELECT 1 FROM pg_database WHERE datname=$1", [restoreDatabase],
);
assert.equal(exists.rowCount, 0, "Restore drill DB must not exist");
await source.query(`CREATE DATABASE "${restoreDatabase}"`);
if (ownership) await source.query(`COMMENT ON DATABASE "${restoreDatabase}" IS '${ownership}'`);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ez-backup-smoke-"));
const uploads = path.join(temp, "uploads");
await fs.mkdir(uploads);
await fs.writeFile(
  path.join(uploads, "synthetic.txt"),
  "synthetic backup fixture\n",
);
const base = {
  ...process.env,
  DATABASE_URL: raw,
  BACKUP_KEY: randomBytes(32).toString("base64"),
  BACKUP_DIR: path.join(temp, "encrypted"),
  BACKUP_UPLOADS_DIR: uploads,
  BACKUP_WRITES_PAUSED: "true",
  RESTORE_DATABASE_URL: destination.toString(),
  RESTORE_CONFIRM_DATABASE: restoreDatabase,
  // The production restore tool recognizes one fixed drill name. This harness
  // has already restricted generated targets to distinct local *_test databases.
  RESTORE_ALLOW_NONTEST: "true",
  RESTORE_UPLOADS_DIR: path.join(temp, "restored"),
};
function run(file, args = [], env = base) {
  const r = spawnSync(process.execPath, [file, ...args], {
    env,
    encoding: "utf8",
  });
  return r;
}
try {
  const backup = run("scripts/backup.mjs");
  assert.equal(backup.status, 0, backup.stderr);
  const result = JSON.parse(backup.stdout);
  assert.equal(result.uploaded, false);
  const verification = run("scripts/restore-backup.mjs", [
    result.manifest,
    "--verify-only",
  ]);
  assert.equal(verification.status, 0, verification.stderr);
  const wrong = run(
    "scripts/restore-backup.mjs",
    [result.manifest, "--verify-only"],
    { ...base, BACKUP_KEY: randomBytes(32).toString("base64") },
  );
  assert.notEqual(wrong.status, 0);
  const restore = run("scripts/restore-backup.mjs", [result.manifest]);
  assert.equal(restore.status, 0, restore.stderr);
  const target = new Client({ connectionString: destination.toString() });
  await target.connect();
  const a = await source.query(
    "SELECT code,ai_tokens_used,storage_bytes_used,schema_name FROM ez_control.tenants ORDER BY code",
  );
  const b = await target.query(
    "SELECT code,ai_tokens_used,storage_bytes_used,schema_name FROM ez_control.tenants ORDER BY code",
  );
  assert.deepEqual(b.rows, a.rows);
  for (const tenant of a.rows) {
    assert(/^ez_t_[a-f0-9]{16,64}$/.test(tenant.schema_name));
    const x = await source.query(
        `SELECT count(*) FROM "${tenant.schema_name}".notifications`,
      ),
      y = await target.query(
        `SELECT count(*) FROM "${tenant.schema_name}".notifications`,
      );
    assert.deepEqual(y.rows, x.rows);
  }
  assert.equal(
    await fs.readFile(
      path.join(base.RESTORE_UPLOADS_DIR, "synthetic.txt"),
      "utf8",
    ),
    "synthetic backup fixture\n",
  );
  const overwrite = run("scripts/restore-backup.mjs", [result.manifest]);
  assert.notEqual(overwrite.status, 0, "Nonempty restore must be rejected");
  const env = JSON.parse(await fs.readFile(result.manifest, "utf8"));
  const blob = path.join(
    path.dirname(result.manifest),
    env.payload.files[0].name,
  );
  const bytes = await fs.readFile(blob);
  bytes[bytes.length - 1] ^= 1;
  await fs.writeFile(blob, bytes);
  const tampered = run("scripts/restore-backup.mjs", [
    result.manifest,
    "--verify-only",
  ]);
  assert.notEqual(tampered.status, 0, "Tampered backup must be rejected");
  await target.end();
  console.log(
    JSON.stringify({
      passed: 6,
      failed: 0,
      verified: [
        "encrypted pg_dump and files",
        "authenticated archive",
        "wrong key refusal",
        "tenant data and file restore",
        "nonempty restore refusal",
        "tamper refusal",
      ],
      externalUploads: 0,
    }),
  );
} finally {
  await source.query(`DROP DATABASE "${restoreDatabase}" WITH (FORCE)`);
  await source.end();
  await fs.rm(temp, { recursive: true, force: true });
}
