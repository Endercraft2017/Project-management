#!/usr/bin/env node
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  backupKey,
  digest,
  encrypt,
  decrypt,
  pgTool,
  postgresEnvironment,
  verifyDump,
  signManifest,
} from "./backup-lib.mjs";
const key = backupKey(),
  db = postgresEnvironment(process.env.DATABASE_URL);
const dir = path.resolve(process.env.BACKUP_DIR || "/workspace/.ez-backups");
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
const stamp = `ez-${new Date().toISOString().replace(/[^0-9]/g, "")}-${randomUUID()}`;
const files = [],
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "ez-backup-check-"));
await fs.chmod(temporary, 0o700);
try {
  const name = `${stamp}.pgdump.enc`,
    target = path.join(dir, name),
    dump = pgTool(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl"],
      db.env,
    );
  dump.child.stdin.end();
  try {
    await Promise.all([
      encrypt(dump.child.stdout, target, key),
      dump.completion,
    ]);
  } catch (error) {
    dump.child.kill();
    await fs.rm(target, { force: true });
    throw error;
  }
  const plain = path.join(temporary, "verify.pgdump");
  await decrypt(target, plain, key);
  await verifyDump(plain, db.env);
  files.push({ kind: "database", name, sha256: await digest(target) });
  if (process.env.BACKUP_UPLOADS_DIR) {
    if (process.env.BACKUP_WRITES_PAUSED !== "true")
      throw new Error(
        "Pause application/worker writes before including uploaded files; confirm with BACKUP_WRITES_PAUSED=true",
      );
    const uploads = path.resolve(process.env.BACKUP_UPLOADS_DIR),
      st = await fs.lstat(uploads);
    if (!st.isDirectory() || st.isSymbolicLink())
      throw new Error("Uploads must be a real directory");
    const name = `${stamp}.uploads.enc`,
      target = path.join(dir, name),
      tar = spawn(
        "tar",
        ["-czf", "-", "--one-file-system", "-C", uploads, "."],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    tar.stderr.resume();
    const done = new Promise((resolve, reject) => {
      tar.once("error", () => reject(new Error("tar could not start")));
      tar.once("close", (code) =>
        code === 0 ? resolve() : reject(new Error("File archive failed")),
      );
    });
    done.catch(() => {});
    try {
      await Promise.all([encrypt(tar.stdout, target, key), done]);
    } catch (error) {
      tar.kill();
      await fs.rm(target, { force: true });
      throw error;
    }
    files.push({ kind: "uploads", name, sha256: await digest(target) });
  }
  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    database: db.name,
    files,
  };
  const manifest = path.join(dir, `${stamp}.manifest.json`);
  await fs.writeFile(
    manifest,
    JSON.stringify({ payload, mac: signManifest(payload, key) }, null, 2) +
      "\n",
    { flag: "wx", mode: 0o600 },
  );
  if (process.argv.includes("--upload")) {
    if (
      process.env.BACKUP_UPLOAD_ENABLED !== "true" ||
      process.env.BACKUP_PRIVATE_BUCKET_CONFIRMED !== "true" ||
      !/^s3:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9/_-]*$/.test(
        process.env.BACKUP_S3_URI || "",
      )
    )
      throw new Error(
        "Private bucket upload requires explicit enablement, confirmation and a valid s3://bucket/prefix",
      );
    for (const file of [...files.map((f) => path.join(dir, f.name)), manifest])
      await new Promise((resolve, reject) => {
        const args = [
          "s3",
          "cp",
          file,
          process.env.BACKUP_S3_URI.replace(/\/?$/, "/") + path.basename(file),
          "--only-show-errors",
        ];
        const p = spawn("aws", args, {
          stdio: ["ignore", "ignore", "pipe"],
          env: process.env,
        });
        p.stderr.resume();
        p.once("error", () => reject(new Error("AWS CLI unavailable")));
        p.once("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error("Private backup upload failed")),
        );
      });
  }
  console.log(
    JSON.stringify({
      status: "verified_local_backup",
      manifest,
      files: files.length,
      uploaded: process.argv.includes("--upload"),
    }),
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
