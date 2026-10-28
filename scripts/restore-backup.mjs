#!/usr/bin/env node
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pipeline } from "node:stream/promises";
import {
  backupKey,
  verifyManifest,
  digest,
  decrypt,
  postgresEnvironment,
  pgTool,
  verifyDump,
} from "./backup-lib.mjs";
const manifestPath = process.argv[2];
if (!manifestPath)
  throw new Error(
    "Usage: node scripts/restore-backup.mjs /private/path/manifest.json [--verify-only]",
  );
const key = backupKey(),
  envelope = JSON.parse(await fs.readFile(manifestPath, "utf8")),
  manifest = verifyManifest(envelope, key);
if (
  manifest.version !== 1 ||
  !Array.isArray(manifest.files) ||
  manifest.files.length < 1 ||
  manifest.files.length > 2
)
  throw new Error("Unsupported backup manifest");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ez-restore-"));
await fs.chmod(temp, 0o700);
try {
  const plain = {};
  for (const f of manifest.files) {
    if (
      !["database", "uploads"].includes(f.kind) ||
      plain[f.kind] ||
      !/^ez-[a-z0-9-]+\.(pgdump|uploads)\.enc$/.test(f.name)
    )
      throw new Error("Invalid backup artifact");
    const source = path.join(path.dirname(path.resolve(manifestPath)), f.name);
    if ((await digest(source)) !== f.sha256)
      throw new Error("Encrypted backup checksum mismatch");
    const output = path.join(temp, f.kind);
    await decrypt(source, output, key);
    plain[f.kind] = output;
  }
  if (!plain.database) throw new Error("Database artifact required");
  const config = postgresEnvironment(
    process.env.RESTORE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      (process.argv.includes("--verify-only")
        ? "postgresql://localhost/postgres"
        : undefined),
  );
  await verifyDump(plain.database, config.env);
  if (process.argv.includes("--verify-only")) {
    console.log(
      JSON.stringify({
        status: "authenticated_archive_verified",
        createdAt: manifest.createdAt,
        files: manifest.files.length,
      }),
    );
  } else {
    if (process.env.RESTORE_CONFIRM_DATABASE !== config.name)
      throw new Error(
        "Set RESTORE_CONFIRM_DATABASE to the exact empty target database name",
      );
    if (
      !/_restore_(test|drill)$/.test(config.name) &&
      process.env.RESTORE_ALLOW_NONTEST !== "true"
    )
      throw new Error(
        "Non-drill restore requires separate RESTORE_ALLOW_NONTEST=true confirmation",
      );
    if (
      process.env.DATABASE_URL &&
      process.env.RESTORE_DATABASE_URL &&
      new URL(process.env.DATABASE_URL).pathname ===
        new URL(process.env.RESTORE_DATABASE_URL).pathname
    )
      throw new Error(
        "Restore target must differ from the configured source database",
      );
    const { Client } = createRequire(
      new URL("../server/package.json", import.meta.url),
    )("pg");
    const client = new Client({
      host: config.env.PGHOST,
      port: Number(config.env.PGPORT),
      database: config.name,
      user: config.env.PGUSER,
      password: config.env.PGPASSWORD,
      ssl:
        config.env.PGSSLMODE === "prefer"
          ? undefined
          : {
              rejectUnauthorized: true,
              ...(config.env.PGSSLROOTCERT
                ? { ca: await fs.readFile(config.env.PGSSLROOTCERT, "utf8") }
                : {}),
            },
    });
    await client.connect();
    try {
      const tables = await client.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')",
      );
      if (tables.rows[0].n !== 0)
        throw new Error("Refusing to restore over a nonempty database");
    } finally {
      await client.end();
    }
    let uploads;
    if (plain.uploads) {
      uploads = process.env.RESTORE_UPLOADS_DIR;
      if (!uploads)
        throw new Error(
          "RESTORE_UPLOADS_DIR required for a file-bearing backup",
        );
      await fs.mkdir(uploads, { recursive: true, mode: 0o700 });
      if ((await fs.readdir(uploads)).length)
        throw new Error("Restore uploads destination must be empty");
    }
    const restore = pgTool(
      "pg_restore",
      [
        "--single-transaction",
        "--exit-on-error",
        "--no-owner",
        "--no-acl",
        "--dbname",
        config.name,
      ],
      config.env,
    );
    restore.child.stdout.resume();
    await Promise.all([
      pipeline(createReadStream(plain.database), restore.child.stdin),
      restore.completion,
    ]);
    if (plain.uploads) {
      const code =
        "import tarfile,sys; t=tarfile.open(sys.argv[1], 'r:gz'); t.extractall(sys.argv[2], filter='data')";
      await new Promise((resolve, reject) => {
        const p = spawn("python3", ["-c", code, plain.uploads, uploads], {
          stdio: ["ignore", "ignore", "pipe"],
        });
        p.stderr.resume();
        p.once("error", () =>
          reject(new Error("Python with safe tarfile extraction required")),
        );
        p.once("close", (n) =>
          n === 0
            ? resolve()
            : reject(
                new Error(
                  "Safe file extraction failed; database restored but file restore incomplete",
                ),
              ),
        );
      });
    }
    console.log(
      JSON.stringify({
        status: "restored_to_empty_target",
        database: config.name,
        files: manifest.files.length,
        requiresApplicationSmokeTest: true,
      }),
    );
  }
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
