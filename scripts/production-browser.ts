/** Live browser journey against built API and disposable local PostgreSQL. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL is required for live browser fixtures');
const url = new URL(process.env.TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(url.protocol));
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Browser fixtures require local PostgreSQL');
assert(/^[a-z0-9_]+_test$/i.test(url.pathname.slice(1)), 'Database name must end in _test');
assert(!url.searchParams.has('schema'), 'Do not select an existing tenant schema');
process.env.DATABASE_URL = url.toString();
// The browser uses plain loopback HTTP; production Secure-cookie assertions are
// in production-smoke.ts. This setting is scoped to the disposable child run.
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_URL = 'http://127.0.0.1:5180';
process.env.CORS_ORIGIN = process.env.CLIENT_URL;
process.env.TOUR_PORT = '5180';
delete process.env.TOUR_BASE_URL;
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY', 'SMTP_USER', 'SMTP_PASS']) delete process.env[key];
process.env.AI_ENABLED = 'false';
const store = require(resolve(root, 'server/dist/platform/store.js'));
const db = require(resolve(root, 'server/dist/database/client.js'));
const tenancy = require(resolve(root, 'server/dist/tenancy/context.js'));
let server: Server | undefined, operatorId: string | undefined, ownsFixtures = false;

async function main() {
  await store.ensureControlSchema();
  const pool = store.getControlPool();
  const existing = await pool.query('SELECT (SELECT count(*) FROM ez_control.tenants) AS tenants, (SELECT count(*) FROM ez_control.operators) AS operators');
  assert.equal(Number(existing.rows[0].tenants), 0, 'Browser fixture DB must have no existing tenants');
  assert.equal(Number(existing.rows[0].operators), 0, 'Browser fixture DB must have no existing operators');
  ownsFixtures = true;
  const email = `browser-${randomUUID()}@example.invalid`, password = `Browser-${randomBytes(16).toString('hex')}!`;
  const { hashPassword } = require(resolve(root, 'server/dist/auth/password.js'));
  const operator = await store.bootstrapOperator({ email, name: 'Browser fixture operator', passwordHash: await hashPassword(password) }); operatorId = operator.id;
  server = createServer(require(resolve(root, 'server/dist/app.js')).default);
  const sockets = require(resolve(root, 'server/dist/chat/socket-server.js'));
  const io = sockets.initializeSocketServer(server);
  io.use(require(resolve(root, 'server/dist/chat/socket-middleware.js')).authenticateSocket);
  require(resolve(root, 'server/dist/chat/socket-handlers.js')).registerSocketHandlers(io);
  // Existing Vite proxy resolves localhost:3000. Refuse an occupied port rather
  // than reusing an unknown process or stopping another developer's service.
  await new Promise<void>((done, reject) => { server!.once('error', reject); server!.listen(3000, 'localhost', done); });
  const code = await new Promise<number>((done, reject) => {
    const arguments_ = ['run', 'test:tour', '--workspace=client'];
    if (process.env.ACCESS_E2E_ONLY === '1') arguments_.push('--', 'access-console.pw.ts');
    const child = spawn('npm', arguments_, {
      cwd: root, env: { ...process.env, ACCESS_E2E: '1', E2E_OPERATOR_EMAIL: email, E2E_OPERATOR_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk: Buffer) => { output += chunk.toString(); if (output.length > 2_000_000) { child.kill('SIGTERM'); reject(new Error('Browser output exceeded its diagnostic limit')); } };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (value) => {
      const safe = output.replaceAll(password, '[redacted test password]').replace(/token=[a-f0-9]{32,}/gi, 'token=[redacted]');
      process.stdout.write(safe); done(value ?? 1);
    });
  });
  assert.equal(code, 0, 'Live backend browser journey must pass');
}
async function cleanup() {
  try { await require(resolve(root, 'server/dist/chat/socket-server.js')).closeSocketServer(); } catch { /* Not always initialized. */ }
  if (server?.listening) await new Promise<void>((done) => server!.close(() => done()));
  try { await require(resolve(root, 'server/dist/middlewares/session.js')).closeSessionStore(); } catch { /* Not always initialized. */ }
  try { await require(resolve(root, 'server/dist/platform/routes.js')).closeConsoleSessions(); } catch { /* Not always initialized. */ }
  await db.disconnectPrisma();
  const pool = store.getControlPool();
  if (ownsFixtures) {
    // Attribute fixture ownership to this invocation's random operator, rather
    // than deleting a different developer's catalog record even in a test DB.
    const owned = await pool.query(`SELECT DISTINCT tenant_id FROM ez_control.audit
      WHERE operator_id=$1 AND action IN ('tenant.provisioning','tenant.created','tenant.provisioning_failed') AND tenant_id IS NOT NULL`, [operatorId]);
    const rows = (await Promise.all(owned.rows.map((row: { tenant_id: string }) => store.getTenantById(row.tenant_id)))).filter(Boolean);
    for (const tenant of rows) {
      const schema = tenancy.validateSchemaName(tenant.schemaName); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      for (const table of ['jobs', 'ai_reservations', 'audit', 'setup_tokens']) {
        if ((await pool.query('SELECT to_regclass($1) AS name', [`ez_control.${table}`])).rows[0].name) await pool.query(`DELETE FROM ez_control.${table} WHERE tenant_id=$1`, [tenant.id]);
      }
      await pool.query('DELETE FROM ez_control.tenants WHERE id=$1', [tenant.id]);
    }
  }
  if (operatorId) { await pool.query('DELETE FROM ez_control.audit WHERE operator_id=$1', [operatorId]); await pool.query('DELETE FROM ez_control.operators WHERE id=$1', [operatorId]); }
  await store.closeControlPool();
}
main().catch((error) => { console.error(`Live browser validation failed: ${error instanceof Error ? error.message : 'Unknown failure'}`); process.exitCode = 1; })
  .finally(async () => { try { await cleanup(); } catch { console.error('Browser fixture cleanup failed; inspect dedicated test DB before reuse.'); process.exitCode = 1; } });
