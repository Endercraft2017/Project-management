/** Real first-operator setup proof in a newly created, owned local sibling DB. */
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
const root = resolve(__dirname, '..');
const { Client } = createRequire(resolve(root, 'server/package.json'))('pg');
const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL is required');
const base = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(base.protocol));
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
assert(/^[a-z0-9_]+_test$/i.test(base.pathname.slice(1)));
assert(!base.hash && [...base.searchParams].length === 0);
const name = `ez_operator_setup_${randomUUID().replaceAll('-', '')}_test`;
const target = new URL(base); target.pathname = `/${name}`;
const admin = new Client({ connectionString: supplied });
let owns = false, passed = 0, server: Server | undefined, setupURL = '';
process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_URL = 'http://localhost:5173'; process.env.CORS_ORIGIN = process.env.CLIENT_URL;
for (const key of ['OPERATOR_BOOTSTRAP_ENABLED', 'OPERATOR_SETUP_EMAIL', 'OPERATOR_SETUP_NAME', 'OPERATOR_SETUP_CODE', 'OPERATOR_SETUP_REISSUE_PENDING']) delete process.env[key];
const setup = require(resolve(root, 'server/dist/platform/operator-setup.js'));
const store = require(resolve(root, 'server/dist/platform/store.js'));
const passwords = require(resolve(root, 'server/dist/auth/password.js'));
async function check(label: string, action: () => Promise<void>) { await action(); passed++; console.log(`PASS ${label}`); }
async function main() {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); owns = true;
  await store.ensureControlSchema(); const pool = store.getControlPool();
  const email = 'operator@example.invalid'; let code = randomBytes(32).toString('hex');
  const input = { email, name: 'Local operator fixture', setupCode: code };
  const password = `Setup-${randomBytes(18).toString('hex')}!`;
  await check('startup setup is disabled unless explicitly enabled', async () => {
    assert.equal(await setup.provisionInitialOperatorFromEnvironment(), 'disabled');
    assert.equal((await pool.query('SELECT count(*) AS count FROM ez_control.operators')).rows[0].count, '0');
  });
  await check('partial enabled setup fails without provisioning or retaining setup env', async () => {
    process.env.OPERATOR_BOOTSTRAP_ENABLED = 'true'; process.env.OPERATOR_SETUP_EMAIL = email;
    await assert.rejects(setup.provisionInitialOperatorFromEnvironment());
    assert.equal(process.env.OPERATOR_SETUP_EMAIL, undefined);
    assert.equal(process.env.OPERATOR_BOOTSTRAP_ENABLED, undefined);
    assert.equal((await pool.query('SELECT count(*) AS count FROM ez_control.operators')).rows[0].count, '0');
  });
  await check('concurrent startup can create only one pending operator', async () => {
    const statuses = await Promise.all([setup.provisionInitialOperator(input), setup.provisionInitialOperator(input)]);
    assert.deepEqual(statuses.sort(), ['already-exists', 'created']);
    const rows = (await pool.query('SELECT * FROM ez_control.operators')).rows; assert.equal(rows.length, 1);
    assert.equal(await passwords.verifyPassword(code, rows[0].password_hash), false);
    const token = (await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows[0];
    assert.equal(token.token_hash, createHash('sha256').update(code).digest('hex'));
    assert.notEqual(token.token_hash, code);
    assert(new Date(token.expires_at).getTime() - Date.now() > 3500_000);
  });
  await check('existing accounts and setup expiry are preserved on redeploy', async () => {
    const before = await pool.query('SELECT password_hash,session_version FROM ez_control.operators');
    const token = await pool.query('SELECT expires_at,token_hash FROM ez_control.operator_setup_tokens');
    assert.equal(await setup.provisionInitialOperator({ ...input, email: 'different@example.invalid', setupCode: randomBytes(32).toString('hex') }), 'already-exists');
    assert.deepEqual((await pool.query('SELECT password_hash,session_version FROM ez_control.operators')).rows, before.rows);
    assert.deepEqual((await pool.query('SELECT expires_at,token_hash FROM ez_control.operator_setup_tokens')).rows, token.rows);
  });
  await check('wrong email/code and weak password never consume setup', async () => {
    for (const change of [{ email: 'wrong@example.invalid' }, { setupCode: randomBytes(32).toString('hex') }, { password: 'short' }]) {
      await assert.rejects(setup.activateInitialOperator({ email, setupCode: code, password, ...change }));
    }
    assert.equal((await pool.query('SELECT consumed_at FROM ez_control.operator_setup_tokens')).rows[0].consumed_at, null);
  });
  await check('private reissue refuses unexpired pending setup without changing its state', async () => {
    const before = (await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows;
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup({ ...input, setupCode: randomBytes(32).toString('hex') }));
    assert.deepEqual((await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows, before);
  });
  await check('expired setup does not change the password', async () => {
    const before = (await pool.query('SELECT password_hash FROM ez_control.operators')).rows[0].password_hash;
    await pool.query("UPDATE ez_control.operator_setup_tokens SET expires_at=now()-interval '1 second'");
    await assert.rejects(setup.activateInitialOperator({ email, setupCode: code, password }));
    assert.equal((await pool.query('SELECT password_hash FROM ez_control.operators')).rows[0].password_hash, before);
  });
  await check('private reissue requires exactly one matching initial operator and a new code', async () => {
    const replacement = randomBytes(32).toString('hex');
    const before = (await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows;
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup({ ...input, email: 'wrong@example.invalid', setupCode: replacement }));
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup(input));
    const extraId = randomUUID();
    await pool.query(`INSERT INTO ez_control.operators(id,email,name,password_hash)
      SELECT $1,'other@example.invalid','Other fixture',password_hash FROM ez_control.operators LIMIT 1`, [extraId]);
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup({ ...input, setupCode: replacement }));
    await pool.query('DELETE FROM ez_control.operators WHERE id=$1', [extraId]);
    assert.deepEqual((await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows, before);
    await pool.query('DELETE FROM ez_control.operator_setup_tokens');
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup({ ...input, setupCode: replacement }));
    const original = before[0];
    await pool.query(`INSERT INTO ez_control.operator_setup_tokens(operator_id,token_hash,expires_at,consumed_at)
      VALUES($1,$2,$3,$4)`, [original.operator_id, original.token_hash, original.expires_at, original.consumed_at]);
  });
  await check('explicit private reissue renews only the expired code and records a safe audit', async () => {
    const before = (await pool.query('SELECT * FROM ez_control.operators')).rows;
    const oldCode = code; code = randomBytes(32).toString('hex');
    Object.assign(process.env, { OPERATOR_BOOTSTRAP_ENABLED: 'true', OPERATOR_SETUP_REISSUE_PENDING: 'true',
      OPERATOR_SETUP_EMAIL: email, OPERATOR_SETUP_NAME: input.name, OPERATOR_SETUP_CODE: code });
    assert.equal(await setup.provisionInitialOperatorFromEnvironment(), 'reissued');
    for (const key of ['OPERATOR_BOOTSTRAP_ENABLED', 'OPERATOR_SETUP_REISSUE_PENDING', 'OPERATOR_SETUP_EMAIL', 'OPERATOR_SETUP_NAME', 'OPERATOR_SETUP_CODE']) assert.equal(process.env[key], undefined);
    assert.deepEqual((await pool.query('SELECT * FROM ez_control.operators')).rows, before);
    const token = (await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows[0];
    assert.equal(token.token_hash, createHash('sha256').update(code).digest('hex'));
    assert(new Date(token.expires_at).getTime() - Date.now() > 3500_000);
    await assert.rejects(setup.activateInitialOperator({ email, setupCode: oldCode, password }));
    const audit = (await pool.query("SELECT detail FROM ez_control.audit WHERE action='operator.setup_reissued'")).rows;
    assert.equal(audit.length, 1); assert.deepEqual(audit[0].detail, {});
  });
  await check('concurrent private reissues have one winner and cannot extend an unexpired replacement', async () => {
    await pool.query("UPDATE ez_control.operator_setup_tokens SET expires_at=now()-interval '1 second'");
    const candidates = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
    const results = await Promise.allSettled(candidates.map((setupCode) => setup.reissueExpiredInitialOperatorSetup({ ...input, setupCode })));
    assert.equal(results.filter((v) => v.status === 'fulfilled').length, 1);
    code = candidates[results.findIndex((v) => v.status === 'fulfilled')];
    assert.equal((await pool.query("SELECT count(*) AS count FROM ez_control.audit WHERE action='operator.setup_reissued'")).rows[0].count, '2');
  });
  await check('two redemptions have one winner and codes cannot be reused', async () => {
    const app = require(resolve(root, 'server/dist/app.js')).default; server = createServer(app);
    await new Promise<void>((done, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', done); });
    const address = server!.address(); assert(address && typeof address === 'object');
    setupURL = `http://127.0.0.1:${address.port}/api/console/setup`;
    const redeem = () => fetch(setupURL, { method: 'POST', headers: { Origin: process.env.CLIENT_URL!, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, setupCode: code, password }) });
    const results = await Promise.all([redeem(), redeem()]);
    assert.deepEqual(results.map((v) => v.status).sort(), [200, 400]);
    assert(results.every((v) => v.headers.get('set-cookie') === null));
    assert.equal((await fetch(setupURL.replace('/setup', '/me'))).status, 401);
    await assert.rejects(setup.activateInitialOperator({ email, setupCode: code, password }));
    const row = (await pool.query('SELECT password_hash,session_version FROM ez_control.operators')).rows[0];
    assert.equal(await passwords.verifyPassword(password, row.password_hash), true); assert.equal(row.session_version, 1);
    const audit = (await pool.query("SELECT action,detail FROM ez_control.audit WHERE action LIKE 'operator.setup_%' ORDER BY created_at")).rows;
    assert.equal(audit.length, 4); assert(audit.every((v: { detail: object }) => JSON.stringify(v.detail) === '{}'));
  });
  await check('private reissue never changes an activated operator or consumed token', async () => {
    await pool.query("UPDATE ez_control.operator_setup_tokens SET expires_at=now()-interval '1 second'");
    const operator = (await pool.query('SELECT * FROM ez_control.operators')).rows;
    const token = (await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows;
    await assert.rejects(setup.reissueExpiredInitialOperatorSetup({ ...input, setupCode: randomBytes(32).toString('hex') }));
    assert.deepEqual((await pool.query('SELECT * FROM ez_control.operators')).rows, operator);
    assert.deepEqual((await pool.query('SELECT * FROM ez_control.operator_setup_tokens')).rows, token);
  });
  await check('public setup rejects untrusted origin and never creates or authenticates accounts', async () => {
    const request = (origin: string) => fetch(setupURL, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, setupCode: code, password }) });
    assert.equal((await request('https://untrusted.example.invalid')).status, 403);
    const used = await request(process.env.CLIENT_URL!); assert.equal(used.status, 400);
    assert.equal(used.headers.get('set-cookie'), null);
    assert.equal((await pool.query('SELECT count(*) AS count FROM ez_control.operators')).rows[0].count, '1');
  });
  console.log(JSON.stringify({ passed, failed: 0, database: 'owned local sibling', externalCalls: 0 }));
}
main().catch(() => { console.error('Operator setup proof failed; inspect guarded local fixtures without printing credentials.'); process.exitCode = 1; }).finally(async () => {
  if (server?.listening) await new Promise<void>((done) => server!.close(() => done()));
  await require(resolve(root, 'server/dist/platform/routes.js')).closeConsoleSessions();
  await require(resolve(root, 'server/dist/middlewares/session.js')).closeSessionStore();
  await require(resolve(root, 'server/dist/database/client.js')).disconnectPrisma();
  await store.closeControlPool();
  if (owns) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
});
