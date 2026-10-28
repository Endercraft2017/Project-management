#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
export async function createLocalEnvironment(root = repository) {
  const backend = path.join(root, "server", ".env"),
    postgres = path.join(root, ".env.local");
  const hasBackend = await exists(backend),
    hasPostgres = await exists(postgres);
  if (hasBackend && hasPostgres)
    return { status: "retained_existing_local_configuration" };
  if (hasBackend || hasPostgres)
    throw new Error(
      "Partial local configuration exists; preserve it and reconcile manually before running this helper",
    );
  await fs.mkdir(path.dirname(backend), { recursive: true });
  const password = randomBytes(24).toString("hex");
  const content = `# Generated local development only. Never reuse these secrets in production.\nNODE_ENV=development\nPORT=3000\nDATABASE_URL=postgresql://ez_local:${password}@127.0.0.1:5432/ez_development\nSESSION_SECRET=${randomBytes(48).toString("hex")}\nCONSOLE_SESSION_SECRET=${randomBytes(48).toString("hex")}\nCLIENT_URL=http://localhost:5173\nCORS_ORIGIN=http://localhost:5173\nAPP_URL=http://localhost:5173\nAI_ENABLED=false\nMAIL_ENABLED=false\nWORKER_ENABLED=false\nSCHEDULER_TIMEZONE=UTC\nTENANT_DB_MAX_CLIENTS=32\nTENANT_DB_POOL_SIZE=2\n`;
  await fs.writeFile(backend, content, { flag: "wx", mode: 0o600 });
  await fs.writeFile(
    postgres,
    `# Local PostgreSQL container only. Do not commit.\nPOSTGRES_USER=ez_local\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=ez_development\n`,
    { flag: "wx", mode: 0o600 },
  );
  return { status: "created_private_local_configuration" };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  createLocalEnvironment()
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        "Local configuration not changed safely; inspect existing file presence/permissions without printing secrets.",
      );
      process.exitCode = 1;
    });
