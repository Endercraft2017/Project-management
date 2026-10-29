/** Real built-API/PostgreSQL checks. Refuses nonlocal databases and names not ending _test. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..'), origin = 'http://localhost:5173';
const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL must identify a dedicated disposable local database');
const testURL = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(testURL.protocol), 'PostgreSQL is required');
assert(['localhost', '127.0.0.1', '[::1]'].includes(testURL.hostname), 'Only local test PostgreSQL is permitted');
assert(/^[a-z0-9_]+_test$/i.test(testURL.pathname.slice(1)), 'Dedicated database name must end in _test');
assert(!testURL.searchParams.has('schema'), 'Do not select a tenant schema in TEST_DATABASE_URL');
process.env.DATABASE_URL = supplied;
process.env.NODE_ENV = 'production';
process.env.TZ = 'UTC';
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_URL = origin; process.env.CORS_ORIGIN = origin; process.env.ADMIN_EMAILS = '';
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY', 'SMTP_USER', 'SMTP_PASS']) delete process.env[key];
process.env.AI_ENABLED = 'false';

// Test the built candidate, not an independently transpiled application copy.
const store = require(resolve(root, 'server/dist/platform/store.js'));
const db = require(resolve(root, 'server/dist/database/client.js'));
const tenancy = require(resolve(root, 'server/dist/tenancy/context.js'));
const usage = require(resolve(root, 'server/dist/platform/usage.js'));
type Tenant = { id: string; code: string; schemaName: string; name: string };
type Reply = { status: number; data: any; cookies: string[] };
const created: Tenant[] = [];
const contexts = new Map<string, string>();
let server: Server | undefined, base = '', operatorId: string | undefined, passed = 0;

async function check(label: string, action: () => Promise<void> | void) {
  await action(); passed++; console.log(`PASS ${label}`);
}
async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string | null; expectedContext?: string | null } = {}): Promise<Reply> {
  assert(path.startsWith('/api/') || path.startsWith('/health/'), 'Only local application API requests are permitted');
  const headers: Record<string, string> = { 'X-Forwarded-Proto': 'https' };
  if (options.cookie) headers.Cookie = options.cookie;
  const expectedContext = options.expectedContext === undefined ? contexts.get(options.cookie || '') : options.expectedContext;
  if (expectedContext) headers['X-EZ-Workspace'] = expectedContext;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.origin !== null) headers.Origin = options.origin || origin;
  const result = await fetch(`${base}${path}`, { method: options.method || 'GET', headers, redirect: 'manual',
    body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(15_000) });
  if (result.status === 204) return { status: 204, data: null, cookies: result.headers.getSetCookie() };
  assert(result.headers.get('content-type')?.includes('application/json'), `Expected API JSON at ${path}`);
  return { status: result.status, data: await result.json(), cookies: result.headers.getSetCookie() };
}
function status(reply: Reply, expected: number) { assert.equal(reply.status, expected, `Expected HTTP ${expected}, received ${reply.status}`); }
function cookie(reply: Reply, name: string): string {
  const value = reply.cookies.find((item) => item.startsWith(`${name}=`));
  assert(value, `Expected server-issued ${name} cookie`);
  assert(/;\s*HttpOnly/i.test(value) && /;\s*Secure/i.test(value), 'Production session must be HttpOnly and Secure');
  const cookieValue = value.split(';')[0];
  if (reply.data.workspaceContext) contexts.set(cookieValue, reply.data.workspaceContext);
  return cookieValue;
}
const login = (tenant: Tenant, password: string) => request('/api/auth/login', { method: 'POST', body: { tenantCode: tenant.code, email: 'owner@example.invalid', password } });
async function bootstrap(email: string, password: string): Promise<{ code: number; output: string }> {
  return new Promise((done, reject) => {
    const child = spawn(resolve(root, 'node_modules/.bin/tsx'), [resolve(root, 'scripts/bootstrap-operator.ts')], { cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { errors += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => { assert(!output.includes(password) && !errors.includes(password), 'Bootstrap must never print its password'); done({ code: code ?? 1, output }); });
    child.stdin.end(JSON.stringify({ email, name: 'Local test operator', password }));
  });
}
async function provision(operatorCookie: string, name: string) {
  const result = await request('/api/console/tenants', { method: 'POST', cookie: operatorCookie, body: { name, ownerEmail: 'owner@example.invalid', ownerName: `${name} owner` } });
  status(result, 201); assert(!('schemaName' in result.data.data), 'DTO must not expose the schema selector');
  const tenant: Tenant = await store.getTenantByCode(result.data.data.code); assert(tenant); created.push(tenant);
  const setup = new URL(result.data.setupUrl, origin); assert.equal(setup.pathname, '/activate');
  const token = setup.searchParams.get('token'); assert(token);
  return { tenant, token };
}

async function main() {
  await store.ensureControlSchema();
  const pool = store.getControlPool();
  const count = await pool.query('SELECT (SELECT count(*) FROM ez_control.tenants) AS tenants, (SELECT count(*) FROM ez_control.operators) AS operators');
  assert.equal(Number(count.rows[0].tenants), 0, 'Test database must have no existing tenant records');
  assert.equal(Number(count.rows[0].operators), 0, 'Test database must have no existing operators');
  const app = require(resolve(root, 'server/dist/app.js')).default;
  server = createServer(app);
  await new Promise<void>((done, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', done); });
  const address = server.address(); assert(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
  await check('core artifact starts without external integration credentials', async () => {
    status(await request('/health/live'), 200); status(await request('/health/ready'), 200);
    const capabilities = await request('/api/auth/capabilities'); status(capabilities, 200);
    assert.equal(capabilities.data.passwordEnabled, true); assert.equal(capabilities.data.googleEnabled, false);
    status(await request('/api/auth/google'), 503);
  });
  await check('missing tenant context fails closed', () => { assert.throws(() => db.prisma.user.count(), /Tenant context is required/); });
  await check('nested credential fields are omitted without destroying date values', () => {
    const encoded = JSON.stringify({ user: { name: 'Synthetic user', passwordHash: 'private-placeholder', sessionVersion: 4,
      nested: { googleRefreshToken: 'private-placeholder', safe: true } }, date: new Date('2026-01-01T00:00:00Z') }, app.get('json replacer'));
    const decoded = JSON.parse(encoded);
    assert.deepEqual(decoded.user, { name: 'Synthetic user', nested: { safe: true } });
    assert.equal(decoded.date, '2026-01-01T00:00:00.000Z');
  });
  status(await request('/api/tasks'), 401);
  const opEmail = `operator-${randomUUID()}@example.invalid`;
  let opPassword = `Local-${randomBytes(18).toString('hex')}!`;
  await check('first operator bootstraps through stdin only', async () => {
    const result = await bootstrap(opEmail, opPassword); assert.equal(result.code, 0, 'First bootstrap must succeed');
    const parsed = JSON.parse(result.output.trim()); assert.equal(parsed.success, true); operatorId = parsed.operator.id;
  });
  await check('repeat operator bootstrap is denied', async () => { assert.notEqual((await bootstrap(opEmail, opPassword)).code, 0); });
  await check('operator writes require a trusted Origin', async () => {
    for (const origin of [null, 'https://untrusted.example.invalid']) status(await request('/api/console/login', { method: 'POST', origin, body: { email: opEmail, password: opPassword } }), 403);
  });
  const opLogin = await request('/api/console/login', { method: 'POST', body: { email: opEmail, password: opPassword } }); status(opLogin, 200);
  let opCookie = cookie(opLogin, 'ez.operator.sid');
  await check('operator cookie is distinct from tenant authority', async () => {
    assert(opLogin.cookies.some((value) => /SameSite=Strict/i.test(value) && /Path=\/api\/console/i.test(value)));
    status(await request('/api/console/me', { cookie: opCookie }), 200);
    status(await request('/api/auth/me', { cookie: opCookie }), 401);
  });
  await check('operator password changes require authentication, origin, current password and policy', async () => {
    const newPassword = `Rotated-${randomBytes(18).toString('hex')}!`;
    const body = { currentPassword: opPassword, newPassword };
    status(await request('/api/console/password', { method: 'POST', body }), 401);
    status(await request('/api/console/password', { method: 'POST', cookie: opCookie, origin: null, body }), 403);
    const incorrect = await request('/api/console/password', { method: 'POST', cookie: opCookie, body: { ...body, currentPassword: 'Wrong-password!' } });
    status(incorrect, 403); assert.equal(incorrect.data.error, 'CURRENT_PASSWORD_INVALID');
    for (const newPassword of ['short', '😀'.repeat(19), opPassword]) {
      status(await request('/api/console/password', { method: 'POST', cookie: opCookie, body: { ...body, newPassword } }), 400);
    }
    status(await request('/api/console/password', { method: 'POST', cookie: opCookie, body: { ...body, operatorId } }), 400);
    status(await request('/api/console/me', { cookie: opCookie }), 200);
  });
  await check('operator password rotation renews this cookie and revokes other sessions', async () => {
    const another = await request('/api/console/login', { method: 'POST', body: { email: opEmail, password: opPassword } }); status(another, 200);
    const anotherCookie = cookie(another, 'ez.operator.sid'), oldCookie = opCookie;
    const newPassword = `Rotated-${randomBytes(18).toString('hex')}!`;
    const result = await request('/api/console/password', { method: 'POST', cookie: opCookie, body: { currentPassword: opPassword, newPassword } }); status(result, 200);
    opCookie = cookie(result, 'ez.operator.sid'); assert.notEqual(opCookie, oldCookie);
    status(await request('/api/console/me', { cookie: opCookie }), 200);
    status(await request('/api/console/me', { cookie: oldCookie }), 401);
    status(await request('/api/console/me', { cookie: anotherCookie }), 401);
    status(await request('/api/console/login', { method: 'POST', body: { email: opEmail, password: opPassword } }), 401);
    status(await request('/api/console/login', { method: 'POST', body: { email: opEmail, password: newPassword } }), 200);
    const audit = await pool.query("SELECT detail FROM ez_control.audit WHERE action='operator.password_changed' AND operator_id=$1", [operatorId]);
    assert.equal(audit.rows.length, 1); assert.deepEqual(audit.rows[0].detail, {});
    opPassword = newPassword;
  });
  await check('concurrent verified operator rotations cannot overwrite the winner', async () => {
    const current = await store.findOperatorByEmail(opEmail);
    const { hashPassword } = require(resolve(root, 'server/dist/auth/password.js'));
    const passwords = [0, 1].map(() => `Concurrent-${randomBytes(18).toString('hex')}!`);
    const hashes = await Promise.all(passwords.map((password) => hashPassword(password)));
    const outcomes = await Promise.allSettled(hashes.map((passwordHash) => store.changeOperatorPassword({ id: current.id, expectedVersion: current.sessionVersion, expectedHash: current.passwordHash, passwordHash })));
    const winner = outcomes.findIndex((result) => result.status === 'fulfilled');
    assert(winner >= 0); assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
    const loser = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal(loser.reason.status, 409);
    status(await request('/api/console/me', { cookie: opCookie }), 401);
    const logged = await request('/api/console/login', { method: 'POST', body: { email: opEmail, password: passwords[winner] } }); status(logged, 200);
    opCookie = cookie(logged, 'ez.operator.sid'); opPassword = passwords[winner];
    const audit = await pool.query("SELECT detail FROM ez_control.audit WHERE action='operator.password_changed' AND operator_id=$1", [operatorId]);
    assert.equal(audit.rows.length, 2); assert(audit.rows.every((row: { detail: object }) => JSON.stringify(row.detail) === '{}'));
  });
  const first = await provision(opCookie, 'Smoke Alpha'), second = await provision(opCookie, 'Smoke Beta');
  const a = first.tenant, b = second.tenant;
  await check('operator provisioning allocates independent tenant schemas', () => {
    assert.notEqual(a.id, b.id); assert.notEqual(a.code, b.code); assert.notEqual(a.schemaName, b.schemaName);
    assert(/^[A-Z][0-9]{4}[A-Z]$/.test(a.code)); assert(/^ez_t_[a-f0-9]+$/.test(a.schemaName));
  });
  const passwordA = `Alpha-${randomBytes(16).toString('hex')}!`, passwordB = `Beta-${randomBytes(16).toString('hex')}!`;
  await check('activation is tenant-scoped and one use', async () => {
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token: first.token, password: passwordA } }), 200);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: b.code, token: second.token, password: passwordB } }), 200);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token: first.token, password: passwordA } }), 400);
  });
  await check('wrong password and same-email wrong company are rejected', async () => {
    status(await login(a, 'Not-the-password!'), 401); status(await login(a, passwordB), 401);
    status(await login(b, passwordA), 401); status(await login({ ...a, code: 'Z9999Z' }, passwordA), 401);
  });
  await check('tenant login also rejects missing Origin', async () => {
    status(await request('/api/auth/login', { method: 'POST', origin: null, body: { tenantCode: a.code, email: 'owner@example.invalid', password: passwordA } }), 403);
  });
  const aLogin = await login(a, passwordA), bLogin = await login(b, passwordB); status(aLogin, 200); status(bLogin, 200);
  let aCookie = cookie(aLogin, 'connect.sid'); const bCookie = cookie(bLogin, 'connect.sid');
  const aUser = aLogin.data.user, bUser = bLogin.data.user;
  await check('same email resolves to tenant-local accounts', async () => {
    assert.equal(aUser.email, bUser.email); assert.notEqual(aUser.id, bUser.id);
    assert(!('passwordHash' in aUser) && !('passwordHash' in bUser));
    const me = await request('/api/auth/me', { cookie: aCookie }); status(me, 200); assert.equal(me.data.tenant.id, a.id);
    const listed = await request('/api/users', { cookie: aCookie }); status(listed, 200);
    assert(!JSON.stringify(listed.data).includes('"passwordHash"') && !JSON.stringify(listed.data).includes('"sessionVersion"'));
    status(await request('/api/console/tenants', { cookie: aCookie }), 401);
  });
  const memberEmail = 'member@example.invalid', memberPassword = `Member-${randomBytes(16).toString('hex')}!`;
  let memberCookie = '';
  await check('tenant-admin invitation is company-bound and one use', async () => {
    const invitation = await request('/api/invites', { method: 'POST', cookie: aCookie, body: { email: memberEmail, name: 'Synthetic member', role: 'MEMBER' } }); status(invitation, 201);
    const token = new URL(invitation.data.setupUrl, origin).searchParams.get('token'); assert(token);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: b.code, token, password: memberPassword } }), 400);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: memberPassword } }), 200);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: memberPassword } }), 400);
    const logged = await request('/api/auth/login', { method: 'POST', body: { tenantCode: a.code, email: memberEmail, password: memberPassword } }); status(logged, 200); memberCookie = cookie(logged, 'connect.sid');
  });
  await check('ordinary tenant member cannot provision tenants or invite administrators', async () => {
    status(await request('/api/console/tenants', { cookie: memberCookie }), 401);
    status(await request('/api/invites', { method: 'POST', cookie: memberCookie, body: { email: 'other@example.invalid', role: 'ADMIN' } }), 403);
  });
  await check('concurrent invitations enforce seats and revoked links cannot activate', async () => {
    status(await request(`/api/console/tenants/${a.id}`, { method: 'PATCH', cookie: opCookie, body: { seatLimit: 3 } }), 200);
    const attempts = await Promise.all(['one', 'two'].map((name) => request('/api/invites', {
      method: 'POST', cookie: aCookie, body: { email: `pending-${name}@example.invalid`, role: 'MEMBER' },
    })));
    assert.deepEqual(attempts.map((item) => item.status).sort(), [201, 409]);
    const accepted = attempts.find((item) => item.status === 201)!;
    const token = new URL(accepted.data.setupUrl, origin).searchParams.get('token'); assert(token);
    status(await request(`/api/invites/${accepted.data.data.id}`, { method: 'DELETE', cookie: aCookie }), 200);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: memberPassword } }), 400);
    const listing = await request('/api/invites', { cookie: aCookie }); status(listing, 200);
    assert(!JSON.stringify(listing.data).includes(token), 'Listed invitations must not return one-use credentials');
  });
  const clientA = db.createTenantClient(a), clientB = db.createTenantClient(b), collisionId = randomUUID(), onlyB = randomUUID();
  await check('workspace owner cannot be deactivated or demoted', async () => {
    status(await request(`/api/users/${aUser.id}`, { method: 'DELETE', cookie: aCookie }), 409);
    status(await request(`/api/users/${aUser.id}/role`, { method: 'PUT', cookie: aCookie, body: { role: 'MEMBER' } }), 409);
    assert.equal((await clientA.user.findUnique({ where: { id: aUser.id } })).role, 'ADMIN');
  });
  await check('an expired invite cannot revoke a newer invitation for the same account', async () => {
    const input = { email: 'renewed@example.invalid', role: 'MEMBER' };
    const old = await request('/api/invites', { method: 'POST', cookie: aCookie, body: input }); status(old, 201);
    const target = await clientA.user.findUnique({ where: { email: input.email } });
    await pool.query("UPDATE ez_control.setup_tokens SET expires_at=now()-interval '1 minute' WHERE tenant_id=$1 AND target_user_id=$2 AND consumed_at IS NULL", [a.id, target.id]);
    const fresh = await request('/api/invites', { method: 'POST', cookie: aCookie, body: input }); status(fresh, 201);
    status(await request(`/api/invites/${old.data.data.id}`, { method: 'DELETE', cookie: aCookie }), 200);
    const token = new URL(fresh.data.setupUrl, origin).searchParams.get('token'); assert(token);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: memberPassword } }), 200);
    assert.equal((await clientA.user.findUnique({ where: { id: target.id } })).isActive, true);
  });
  await check('reactivation cannot bypass seats or revive passwordless revoked users', async () => {
    const target = await clientA.user.findUnique({ where: { email: memberEmail } });
    status(await request(`/api/users/${target.id}`, { method: 'DELETE', cookie: aCookie }), 204);
    const fresh = await request('/api/invites', { method: 'POST', cookie: aCookie, body: { email: 'seat-fixture@example.invalid', role: 'MEMBER' } }); status(fresh, 201);
    status(await request(`/api/users/${target.id}/activate`, { method: 'POST', cookie: aCookie }), 409);
    status(await request(`/api/invites/${fresh.data.data.id}`, { method: 'DELETE', cookie: aCookie }), 200);
    const pending = await clientA.user.findUnique({ where: { email: 'seat-fixture@example.invalid' } });
    status(await request(`/api/users/${pending.id}/activate`, { method: 'POST', cookie: aCookie }), 409);
    status(await request(`/api/users/${target.id}/activate`, { method: 'POST', cookie: aCookie }), 200);
    const renewed = await request('/api/auth/login', { method: 'POST', body: { tenantCode: a.code, email: memberEmail, password: memberPassword } }); status(renewed, 200); memberCookie = cookie(renewed, 'connect.sid');
  });
  await clientA.task.create({ data: { id: collisionId, taskName: 'Alpha only', createdById: aUser.id, assignedToId: aUser.id } });
  await clientB.task.create({ data: { id: collisionId, taskName: 'Beta only', createdById: bUser.id, assignedToId: bUser.id } });
  await clientB.task.create({ data: { id: onlyB, taskName: 'Beta private record', createdById: bUser.id } });
  await check('colliding IDs and client scope hints cannot cross schemas', async () => {
    const firstRead = await request(`/api/tasks/${collisionId}`, { cookie: aCookie }), secondRead = await request(`/api/tasks/${collisionId}`, { cookie: bCookie });
    status(firstRead, 200); status(secondRead, 200); assert.equal(firstRead.data.data.taskName, 'Alpha only'); assert.equal(secondRead.data.data.taskName, 'Beta only');
    status(await request(`/api/tasks/${onlyB}`, { cookie: aCookie }), 404);
    const hint = await request(`/api/tasks/${collisionId}?tenantCode=${b.code}&schema=${b.schemaName}`, { cookie: aCookie }); status(hint, 200); assert.equal(hint.data.data.taskName, 'Alpha only');
  });
  await check('concurrent asynchronous tenant contexts do not bleed', async () => {
    const names = await Promise.all([a, b].map((tenant) => tenancy.runWithTenant(tenant, async () => {
      await new Promise((done) => setTimeout(done, tenant.id === a.id ? 5 : 1));
      return (await db.prisma.task.findUnique({ where: { id: collisionId } })).taskName;
    }))); assert.deepEqual(names, ['Alpha only', 'Beta only']);
  });
  await check('stale-tab context rejects cookie retargeting before any read or write', async () => {
    const oldContext = contexts.get(aCookie)!;
    const rejected = await request(`/api/tasks/${collisionId}`, { cookie: bCookie, expectedContext: oldContext });
    status(rejected, 409); assert.equal(rejected.data.error, 'WORKSPACE_SESSION_CHANGED');
    status(await request(`/api/tasks/${collisionId}`, { method: 'PATCH', cookie: bCookie, expectedContext: oldContext, body: { taskName: 'Must not be applied' } }), 409);
    status(await request('/api/auth/logout', { method: 'POST', cookie: bCookie, expectedContext: oldContext }), 409);
    status(await request('/api/auth/me', { cookie: bCookie }), 200);
    assert.equal((await clientB.task.findUnique({ where: { id: collisionId } })).taskName, 'Beta only');
    status(await request('/api/tasks', { cookie: bCookie, expectedContext: null }), 409);
  });
  await check('task CRUD persists only in the selected schema', async () => {
    const result = await request('/api/tasks', { method: 'POST', cookie: aCookie, body: { taskName: 'Integration task' } }); status(result, 201); const id = result.data.data.id;
    const initiallyFiltered = await request('/api/tasks?minProgress=99', { cookie: aCookie }); status(initiallyFiltered, 200);
    assert(!initiallyFiltered.data.data.some((task: { id: string }) => task.id === id));
    status(await request(`/api/tasks/${id}`, { method: 'PATCH', cookie: aCookie, body: { progress: 75 } }), 200);
    assert.equal((await clientA.task.findUnique({ where: { id } })).progress, 75); assert.equal(await clientB.task.findUnique({ where: { id } }), null);
    status(await request(`/api/tasks/${id}`, { method: 'PATCH', cookie: aCookie, body: { progress: 100 } }), 200);
    const completed = await request('/api/tasks?minProgress=99', { cookie: aCookie }); status(completed, 200);
    assert(completed.data.data.some((task: { id: string }) => task.id === id));
    status(await request(`/api/tasks/${id}`, { method: 'DELETE', cookie: aCookie }), 204); assert.equal(await clientA.task.findUnique({ where: { id } }), null);
  });
  await check('project detail and backlog tasks are tenant scoped', async () => {
    const result = await request('/api/projects', { method: 'POST', cookie: aCookie, body: { name: 'Synthetic project', description: 'Integration fixture' } }); status(result, 201);
    const project = result.data.data;
    const detail = await request(`/api/projects/${project.id}`, { cookie: aCookie }); status(detail, 200); assert.equal(detail.data.data.name, 'Synthetic project');
    status(await request(`/api/projects/${project.id}`, { cookie: bCookie }), 404);
    const task = await request(`/api/projects/${project.id}/tasks`, { method: 'POST', cookie: aCookie, body: { taskName: 'Backlog fixture' } }); status(task, 201);
    assert.equal(task.data.data.projectId, project.id); assert.equal(task.data.data.sprintId, null);
    status(await request(`/api/projects/${project.id}/tasks`, { method: 'POST', cookie: bCookie, body: { taskName: 'Denied fixture' } }), 404);
    const archived = await request(`/api/projects/${project.id}`, { method: 'PATCH', cookie: aCookie, body: { archived: true, expectedUpdatedAt: project.updatedAt } }); status(archived, 200); assert(archived.data.data.archivedAt);
    status(await request(`/api/projects/${project.id}`, { method: 'PATCH', cookie: aCookie, body: { archived: false, expectedUpdatedAt: project.updatedAt } }), 409);
    status(await request(`/api/projects/${project.id}/tasks`, { method: 'POST', cookie: aCookie, body: { taskName: 'Archived fixture' } }), 404);
  });
  await check('personal notes remain isolated across tenant accounts', async () => {
    const result = await request('/api/notes', { method: 'POST', cookie: aCookie, body: { title: 'Alpha note', content: 'Synthetic test content' } }); status(result, 201);
    const denied = await request(`/api/notes/${result.data.data.id}`, { cookie: bCookie }); assert([403, 404].includes(denied.status)); assert(!denied.data.data);
    const sameTenantDenied = await request(`/api/notes/${result.data.data.id}`, { cookie: memberCookie }); assert([403, 404].includes(sameTenantDenied.status)); assert(!sameTenantDenied.data.data);
  });
  await check('database range constraints reject invalid writers', async () => {
    await assert.rejects(clientA.task.update({ where: { id: collisionId }, data: { progress: 150 } }));
    await assert.rejects(clientA.task.update({ where: { id: collisionId }, data: { nestingLevel: 5 } }));
  });
  await check('storage reservation is atomic under contention', async () => {
    await store.updateTenant(a.id, { storageLimitBytes: 10 }, operatorId);
    const results = await Promise.allSettled([usage.reserveStorage(a.id, 7), usage.reserveStorage(a.id, 7)]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1); assert.equal((await store.getTenantById(a.id)).storageBytesUsed, 7); await usage.releaseStorage(a.id, 7);
  });
  await check('zero AI allowance blocks allocation without provider calls', async () => {
    await assert.rejects(usage.reserveAIUsage(a.id, 1)); assert.equal((await store.getTenantById(a.id)).aiTokensUsed, 0);
  });
  await check('summary reads, disabled AI and typed settings preserve tenant boundaries', async () => {
    const summary = await clientA.weeklySummary.create({ data: { weekStartDate: new Date('2026-01-05T00:00:00Z'), weekEndDate: new Date('2026-01-11T00:00:00Z') } });
    const own = await request('/api/summaries/2026-01-05', { cookie: aCookie }); status(own, 200); assert.equal(own.data.data.id, summary.id);
    status(await request('/api/summaries/2026-01-05', { cookie: bCookie }), 404);
    const unavailable = await request('/api/summaries/generate', { method: 'POST', cookie: aCookie, body: { weekDate: '2026-01-05' } }); status(unavailable, 503); assert.equal(unavailable.data.error, 'AI_DISABLED');
    status(await request('/api/summaries/generate', { method: 'POST', cookie: aCookie, body: { weekDate: '2026-02-30' } }), 400);
    status(await request('/api/summaries/availability', { cookie: memberCookie }), 403);
    status(await request('/api/admin/worker/status', { cookie: memberCookie }), 403);
    status(await request('/api/admin/settings/weekly-summary-members/config', { method: 'PUT', cookie: aCookie, body: { includedUserIds: [aUser.id] } }), 200);
    const isolated = await request('/api/admin/settings/weekly-summary-members/config', { cookie: bCookie }); status(isolated, 200); assert(!JSON.stringify(isolated.data).includes(aUser.id));
    status(await request('/api/admin/settings', { method: 'POST', cookie: aCookie, body: { key: 'arbitrary', value: true } }), 503);
  });
  await check('mocked AI admission queues a real tenant-scoped job without a provider call', async () => {
    const jobs = require(resolve(root, 'server/dist/platform/jobs.js'));
    const provider = require(resolve(root, 'server/dist/services/openai.service.js')).openAIService;
    const original = provider.getAvailability, originalGenerate = provider.generateWeeklySummary;
    const workerId = randomUUID(); let workerRegistered = false;
    provider.generateWeeklySummary = () => { throw new Error('Provider execution is forbidden in this admission test'); };
    try {
      provider.getAvailability = async () => ({ enabled: true, canGenerate: false, reason: 'AI_QUOTA_EXCEEDED', tokenLimit: 0, tokensUsed: 0, tokensRemaining: 0 });
      const quota = await request('/api/summaries/generate', { method: 'POST', cookie: aCookie, body: { weekDate: '2026-01-19' } }); status(quota, 403); assert.equal(quota.data.error, 'AI_QUOTA_EXCEEDED');
      provider.getAvailability = async () => ({ enabled: true, canGenerate: true, reason: null, tokenLimit: 100, tokensUsed: 0, tokensRemaining: 100 });
      const missingWorker = await request('/api/summaries/generate', { method: 'POST', cookie: aCookie, body: { weekDate: '2026-01-19' } }); status(missingWorker, 503); assert.equal(missingWorker.data.error, 'WORKER_UNAVAILABLE');
      await jobs.touchWorker(workerId); workerRegistered = true;
      const admitted = await request('/api/summaries/generate', { method: 'POST', cookie: aCookie, body: { weekDate: '2026-01-19' } }); status(admitted, 202);
      const job = await request(`/api/summaries/jobs/${admitted.data.data.jobId}`, { cookie: aCookie }); status(job, 200); assert.equal(job.data.data.maxAttempts, 1); assert(!('payload' in job.data.data));
      status(await request(`/api/summaries/jobs/${admitted.data.data.jobId}`, { cookie: bCookie }), 404);
    } finally {
      provider.getAvailability = original; provider.generateWeeklySummary = originalGenerate;
      if (workerRegistered) await jobs.forgetWorker(workerId);
    }
  });
  await check('stale session version is rejected', async () => {
    await clientA.user.update({ where: { id: aUser.id }, data: { sessionVersion: { increment: 1 } } }); status(await request('/api/auth/me', { cookie: aCookie }), 401);
    const renewed = await login(a, passwordA); status(renewed, 200); aCookie = cookie(renewed, 'connect.sid');
  });
  await check('disabled account loses established HTTP access', async () => {
    await clientA.user.update({ where: { id: aUser.id }, data: { isActive: false } }); status(await request('/api/auth/me', { cookie: aCookie }), 401);
    await clientA.user.update({ where: { id: aUser.id }, data: { isActive: true } });
    const renewed = await login(a, passwordA); status(renewed, 200); aCookie = cookie(renewed, 'connect.sid');
  });
  await check('suspension revokes sessions without affecting another tenant', async () => {
    status(await request(`/api/console/tenants/${a.id}`, { method: 'PATCH', cookie: opCookie, body: { status: 'SUSPENDED' } }), 200);
    assert([401, 403].includes((await request('/api/auth/me', { cookie: aCookie })).status)); status(await login(a, passwordA), 401);
    status(await request('/api/auth/me', { cookie: bCookie }), 200);
    status(await request(`/api/console/tenants/${a.id}`, { method: 'PATCH', cookie: opCookie, body: { status: 'ACTIVE' } }), 200);
    status(await request('/api/auth/me', { cookie: aCookie }), 401);
  });
  await check('operator audit excludes credentials and setup tokens', async () => {
    const audit = await request('/api/console/audit', { cookie: opCookie }); status(audit, 200); const encoded = JSON.stringify(audit.data);
    for (const value of [first.token, second.token, passwordA, passwordB, opPassword]) assert(!encoded.includes(value), 'Audit must not contain credential material');
  });
  await check('logout destroys the real tenant session', async () => {
    status(await request('/api/auth/logout', { method: 'POST', cookie: bCookie }), 200); status(await request('/api/auth/me', { cookie: bCookie }), 401);
  });
  await check('operator owner recovery is one use and changes the correct credential', async () => {
    const reset = await request(`/api/console/tenants/${a.id}/owner-setup`, { method: 'POST', cookie: opCookie }); status(reset, 200);
    const token = new URL(reset.data.setupUrl, origin).searchParams.get('token'); assert(token);
    const replacement = `Recovered-${randomBytes(16).toString('hex')}!`;
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: replacement } }), 200);
    status(await request('/api/auth/activate', { method: 'POST', body: { tenantCode: a.code, token, password: replacement } }), 400);
    status(await login(a, passwordA), 401); status(await login(a, replacement), 200);
    const audit = await request('/api/console/audit', { cookie: opCookie }); status(audit, 200); assert(!JSON.stringify(audit.data).includes(token));
  });
  await check('operator version invalidation revokes console access', async () => {
    await pool.query('UPDATE ez_control.operators SET session_version=session_version+1 WHERE id=$1', [operatorId]); status(await request('/api/console/me', { cookie: opCookie }), 401);
  });
  console.log(`Completed ${passed} real PostgreSQL/HTTP integration checks; no external provider calls.`);
}

async function cleanup() {
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  try { await require(resolve(root, 'server/dist/middlewares/session.js')).closeSessionStore(); } catch { /* Not always initialized. */ }
  try { await require(resolve(root, 'server/dist/platform/routes.js')).closeConsoleSessions(); } catch { /* Not always initialized. */ }
  await db.disconnectPrisma();
  const pool = store.getControlPool();
  for (const tenant of created) {
    const schema = tenancy.validateSchemaName(tenant.schemaName); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    for (const table of ['jobs', 'ai_reservations', 'audit', 'setup_tokens']) {
      if ((await pool.query('SELECT to_regclass($1) AS name', [`ez_control.${table}`])).rows[0].name) await pool.query(`DELETE FROM ez_control.${table} WHERE tenant_id=$1`, [tenant.id]);
    }
    await pool.query('DELETE FROM ez_control.tenants WHERE id=$1', [tenant.id]);
  }
  if (operatorId) { await pool.query('DELETE FROM ez_control.audit WHERE operator_id=$1', [operatorId]); await pool.query('DELETE FROM ez_control.operators WHERE id=$1', [operatorId]); }
  await store.closeControlPool();
}
main().catch((error) => { console.error(`Integration checks failed after ${passed} passes: ${error instanceof Error ? error.message : 'Unknown failure'}`); process.exitCode = 1; })
  .finally(async () => { try { await cleanup(); } catch { console.error('Fixture cleanup failed; inspect the dedicated test database before rerunning.'); process.exitCode = 1; } });
