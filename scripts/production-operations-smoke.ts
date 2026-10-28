/** Retained worker/backup proof. Creates and drops only this invocation's local test databases. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const { Client } = createRequire(resolve(root, 'server/package.json'))('pg');
const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL must identify a dedicated disposable local database');
const base = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(base.protocol), 'PostgreSQL is required');
assert(['localhost', '127.0.0.1'].includes(base.hostname), 'Only loopback PostgreSQL is permitted');
assert(/^[a-z0-9_]+_test$/i.test(base.pathname.slice(1)), 'Dedicated database name must end in _test');
assert(!base.hash && [...base.searchParams].length === 0, 'Test URL must not override connection/schema options');

const suffix = randomUUID().replaceAll('-', '');
const sourceName = `ez_ops_${suffix}_test`, restoreName = `ez_ops_restore_${suffix}_test`;
const marker = `ez-operations-smoke:${suffix}`;
const sourceURL = new URL(base); sourceURL.pathname = `/${sourceName}`;
const toolsContainer = process.env.POSTGRES_TOOLS_CONTAINER;
assert(!toolsContainer || /^[a-zA-Z0-9_.-]+$/.test(toolsContainer), 'Invalid PostgreSQL tools container');
const environment: NodeJS.ProcessEnv = {};
for (const name of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'SYSTEMROOT']) {
  if (process.env[name] !== undefined) environment[name] = process.env[name];
}
Object.assign(environment, {
  NODE_ENV: 'test', DATABASE_URL: sourceURL.toString(), TEST_DATABASE_URL: sourceURL.toString(),
  SESSION_SECRET: randomBytes(48).toString('hex'), CONSOLE_SESSION_SECRET: randomBytes(48).toString('hex'),
  CLIENT_URL: 'http://localhost:5173', CORS_ORIGIN: 'http://localhost:5173', ADMIN_EMAILS: '',
  AI_ENABLED: 'false', MAIL_ENABLED: 'false', OPENAI_API_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  SMTP_USER: '', SMTP_PASS: '', BACKUP_SMOKE_RESTORE_DATABASE: restoreName, BACKUP_SMOKE_OWNER: marker,
});
if (toolsContainer) environment.POSTGRES_TOOLS_CONTAINER = toolsContainer;

let interrupted = false;
let running: ReturnType<typeof spawn> | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  interrupted = true; running?.kill('SIGTERM');
});

function run(command: string, args: string[]): Promise<string> {
  assert(!interrupted, 'Operations smoke interrupted');
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    running = child;
    let output = '', exceeded = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
    const collect = (chunk: Buffer) => {
      if (output.length + chunk.length > 2_000_000) { exceeded = true; child.kill('SIGKILL'); }
      else output += chunk.toString();
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', () => { clearTimeout(timer); running = undefined; reject(new Error('Required local tool could not start')); });
    child.once('close', (code) => {
      clearTimeout(timer); running = undefined;
      if (code !== 0 || interrupted || exceeded) {
        let safe = output.replace(/postgres(?:ql)?:\/\/[^\s'"\]]+/gi, '[redacted PostgreSQL URL]');
        for (const [name, value] of Object.entries(environment)) {
          if (value && /SECRET|PASSWORD|TOKEN|KEY/.test(name)) safe = safe.replaceAll(value, '[redacted test secret]');
        }
        for (const value of [base.password, base.username].filter(Boolean)) {
          safe = safe.replaceAll(value, '[redacted database credential]').replaceAll(decodeURIComponent(value), '[redacted database credential]');
        }
        console.error(safe.trim().split(/\r?\n/).slice(-40).join('\n'));
        reject(new Error('Operations child failed or exceeded its bounded execution limit'));
      }
      else done(output);
    });
  });
}

async function toolVersion(name: 'pg_dump' | 'pg_restore') {
  const output = toolsContainer
    ? await run('docker', ['exec', toolsContainer, name, '--version'])
    : await run(name, ['--version']);
  const match = output.match(/PostgreSQL\) (\d+)\.[\d.]+/);
  assert(match, `Cannot determine ${name} version`);
  return Number(match[1]);
}

async function proof(file: string, expected: number, typescript = false) {
  const args = typescript ? ['--tsconfig', resolve(root, 'server/tsconfig.json'), resolve(root, file)] : [resolve(root, file)];
  const output = await run(typescript ? resolve(root, 'node_modules/.bin/tsx') : process.execPath, args);
  const summary = output.trim().split(/\r?\n/).reverse().map((line) => {
    try { return JSON.parse(line) as { passed?: number; failed?: number }; } catch { return undefined; }
  }).find((value) => value && typeof value.passed === 'number');
  assert.equal(summary?.passed, expected, `${file} must execute every retained check`);
  assert.equal(summary?.failed, 0, `${file} must report no failures`);
  // Child diagnostics can contain database details. Print only known aggregate metadata.
  console.log(JSON.stringify({ script: file, passed: summary.passed, failed: summary.failed }));
}

async function main() {
  const admin = new Client({ connectionString: base.toString(), connectionTimeoutMillis: 5000 });
  await admin.connect();
  let ownsSource = false;
  try {
    const serverMajor = Math.floor(Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num) / 10000);
    const dumpMajor = await toolVersion('pg_dump'), restoreMajor = await toolVersion('pg_restore');
    assert(dumpMajor >= serverMajor && restoreMajor === dumpMajor, 'Matching PostgreSQL clients compatible with the server are required');
    const tar = await run('tar', ['--version']); assert(/tar/i.test(tar), 'tar is required');
    console.log(JSON.stringify({ postgresServerMajor: serverMajor, postgresToolsMajor: dumpMajor, tarAvailable: true, toolsInContainer: Boolean(toolsContainer) }));
    // Names and marker are generated internally; caller database identifiers never enter SQL.
    await admin.query(`CREATE DATABASE "${sourceName}"`); ownsSource = true;
    await admin.query(`COMMENT ON DATABASE "${sourceName}" IS '${marker}'`);
    await proof('scripts/platform-jobs-smoke.ts', 8, true);
    await proof('scripts/backup-smoke.mjs', 6);
  } finally {
    try {
      for (const name of [restoreName, ...(ownsSource ? [sourceName] : [])]) {
        const found = await admin.query("SELECT shobj_description(oid,'pg_database') AS owner FROM pg_database WHERE datname=$1", [name]);
        if (!found.rowCount) continue;
        assert.equal(found.rows[0].owner, marker, 'Refusing to clean a database without this invocation ownership marker');
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      }
    } finally { await admin.end(); }
  }
  console.log(JSON.stringify({ passed: 14, failed: 0, externalCalls: 0, isolatedDatabases: true, cleaned: true }));
}
main().catch(() => {
  // Do not print raw PostgreSQL errors, connection strings, provider settings or child output.
  console.error('Operations smoke failed; confirm local PostgreSQL/tools compatibility and dedicated test database permissions.');
  process.exitCode = 1;
});
