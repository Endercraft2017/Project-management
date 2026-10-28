import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
const MAGIC = Buffer.from("EZBK1");
export function backupKey() {
  const k = Buffer.from(process.env.BACKUP_KEY || "", "base64");
  if (k.length !== 32)
    throw new Error(
      "BACKUP_KEY must be a securely supplied base64 32-byte key",
    );
  return k;
}
export async function digest(path) {
  const h = createHash("sha256");
  for await (const b of createReadStream(path)) h.update(b);
  return h.digest("hex");
}
export function signManifest(payload, key) {
  return createHmac("sha256", key)
    .update("EZ-MANIFEST-V1\n" + JSON.stringify(payload))
    .digest("hex");
}
export function verifyManifest(envelope, key) {
  const e = Buffer.from(signManifest(envelope.payload, key), "hex"),
    a = Buffer.from(envelope.mac || "", "hex");
  if (e.length !== a.length || !timingSafeEqual(e, a))
    throw new Error("Backup manifest authentication failed");
  return envelope.payload;
}
export async function encrypt(input, path, key) {
  const iv = randomBytes(12),
    header = Buffer.concat([MAGIC, iv]),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  await fs.writeFile(path, Buffer.concat([header, Buffer.alloc(16)]), {
    flag: "wx",
    mode: 0o600,
  });
  try {
    await pipeline(
      input,
      cipher,
      createWriteStream(path, { flags: "a", mode: 0o600 }),
    );
    const h = await fs.open(path, "r+");
    try {
      await h.write(cipher.getAuthTag(), 0, 16, 17);
    } finally {
      await h.close();
    }
  } catch (error) {
    await fs.rm(path, { force: true });
    throw error;
  }
}
/** Verify authentication completely before any restore side effects. */
export async function decrypt(path, output, key) {
  const h = await fs.open(path, "r"),
    header = Buffer.alloc(33);
  try {
    const r = await h.read(header, 0, 33, 0);
    if (r.bytesRead !== 33 || !header.subarray(0, 5).equals(MAGIC))
      throw new Error("Invalid encrypted backup");
  } finally {
    await h.close();
  }
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(5, 17));
  decipher.setAAD(header.subarray(0, 17));
  decipher.setAuthTag(header.subarray(17));
  try {
    await pipeline(
      createReadStream(path, { start: 33 }),
      decipher,
      createWriteStream(output, { flags: "wx", mode: 0o600 }),
    );
  } catch {
    await fs.rm(output, { force: true });
    throw new Error("Backup decryption/authentication failed");
  }
}
export function postgresEnvironment(raw) {
  if (!raw) throw new Error("A PostgreSQL URL is required");
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(u.protocol))
    throw new Error("PostgreSQL URL required");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname),
    mode = u.searchParams.get("sslmode") || (local ? "prefer" : "verify-full");
  if (!local && !["verify-full", "verify-ca"].includes(mode))
    throw new Error("Remote backup/restore requires verified PostgreSQL TLS");
  return {
    name: decodeURIComponent(u.pathname.slice(1)),
    env: {
      ...process.env,
      PGHOST: u.hostname.replace(/^\[|\]$/g, ""),
      PGPORT: u.port || "5432",
      PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
      PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGSSLMODE: mode,
    },
  };
}
export function pgTool(name, args, env) {
  const container = process.env.POSTGRES_TOOLS_CONTAINER;
  if (container && !/^[a-zA-Z0-9_.-]+$/.test(container))
    throw new Error("Invalid PostgreSQL tools container");
  const vars = [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSLMODE",
    "PGSSLROOTCERT",
  ];
  const argv = container
    ? [
        "exec",
        "-i",
        ...vars.filter((v) => env[v] !== undefined).flatMap((v) => ["-e", v]),
        container,
        name,
        ...args,
      ]
    : args;
  const child = spawn(container ? "docker" : name, argv, {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const completion = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error(`${name} could not start`)));
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${name} failed; no success recorded`)),
    );
  });
  completion.catch(() => {});
  return { child, completion };
}
export async function verifyDump(path, env) {
  const p = pgTool("pg_restore", ["--list"], env);
  p.child.stdout.resume();
  await Promise.all([
    pipeline(createReadStream(path), p.child.stdin),
    p.completion,
  ]);
}
