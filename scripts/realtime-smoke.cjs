/* Local-only synthetic PostgreSQL + actual HTTP-session/Socket.IO integration. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const root = require('node:path').resolve(__dirname, '..');
const { io: connectSocket } = require(root + '/node_modules/socket.io-client');
const origin = 'http://localhost:5173';
const testURL = new URL(process.env.TEST_DATABASE_URL || '');
assert(
  ['postgres:', 'postgresql:'].includes(testURL.protocol),
  'PostgreSQL required',
);
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(testURL.hostname),
  'Local DB required',
);
assert(
  !testURL.searchParams.has('schema'),
  'Schema selector is not allowed in test connection URL',
);
assert(
  /^[a-z0-9_]+_test$/i.test(testURL.pathname.slice(1)),
  'Disposable _test DB required',
);
process.env.DATABASE_URL = testURL.toString();
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('hex');
process.env.CONSOLE_SESSION_SECRET = crypto.randomBytes(48).toString('hex');
process.env.CLIENT_URL = origin;
process.env.CORS_ORIGIN = origin;
for (const key of [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'SMTP_USER',
  'SMTP_PASS',
])
  delete process.env[key];
process.env.AI_ENABLED = 'false';
const store = require(root + '/server/dist/platform/store');
const db = require(root + '/server/dist/database/client');
const { runWithTenant } = require(root + '/server/dist/tenancy/context');
const sockets = require(root + '/server/dist/chat/socket-server');
const handlers = require(root + '/server/dist/chat/socket-handlers');
const { authenticateSocket } = require(
  root + '/server/dist/chat/socket-middleware',
);
const session = require(root + '/server/dist/middlewares/session');
const { hashPassword } = require(root + '/server/dist/auth/password');
const usage = require(root + '/server/dist/platform/usage');
const owned = [],
  clients = [];
let server,
  base,
  passed = 0;
const query = (...args) => store.getControlPool().query(...args);
async function check(label, fn) {
  await fn();
  passed++;
  console.log('PASS ' + label);
}
const contexts = new Map();
async function request(path, body, cookie) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie, 'X-EZ-Workspace': contexts.get(cookie) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  return {
    status: response.status,
    data: await response.json(),
    cookies: response.headers.getSetCookie(),
  };
}
async function login(tenant, email, password) {
  const r = await request('/api/auth/login', {
    tenantCode: tenant.code,
    email,
    password,
  });
  assert.equal(r.status, 200);
  const cookie = r.cookies.find((x) => x.startsWith('connect.sid='));
  assert(cookie);
  const value = cookie.split(';')[0];
  contexts.set(value, r.data.workspaceContext);
  return value;
}
function socket(cookie, options = {}) {
  return new Promise((resolve, reject) => {
    const s = connectSocket(base, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      extraHeaders: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
      timeout: 3000,
      ...options,
      auth: { ...options.auth, workspaceContext: contexts.get(cookie) },
    });
    clients.push(s);
    const timer = setTimeout(() => {
      s.disconnect();
      reject(Error('Handshake timed out'));
    }, 4000);
    s.once('connect', () => {
      clearTimeout(timer);
      resolve(s);
    });
    s.once('connect_error', (e) => {
      clearTimeout(timer);
      s.disconnect();
      reject(e);
    });
  });
}
function ack(s, event, data) {
  return new Promise((resolve, reject) =>
    s
      .timeout(5000)
      .emit(event, data, (error, value) =>
        error ? reject(error) : resolve(value),
      ),
  );
}
function pause(ms = 150) {
  return new Promise((r) => setTimeout(r, ms));
}
async function disconnected(s) {
  const event = new Promise((r) => s.once('disconnect', r));
  await Promise.race([
    event,
    new Promise((_, reject) =>
      setTimeout(() => reject(Error('Expected disconnect')), 4000),
    ),
  ]);
}
(async () => {
  try {
    await store.ensureControlSchema();
    const password = 'Local-' + crypto.randomBytes(18).toString('hex') + '!',
      hash = await hashPassword(password);
    for (const name of ['Socket Alpha', 'Socket Beta']) {
      const result = await store.createTenant({
        name,
        ownerEmail: 'owner@example.invalid',
        ownerName: 'Synthetic owner',
        storageLimitBytes: 32,
      });
      owned.push(result.tenant);
    }
    const [a, b] = owned,
      shared = crypto.randomUUID(),
      colleague = crypto.randomUUID(),
      conversation = crypto.randomUUID();
    for (const t of owned)
      await runWithTenant(t, async () => {
        await db.prisma.user.create({
          data: {
            id: shared,
            email: 'same@example.invalid',
            name: 'Synthetic member',
            passwordHash: hash,
          },
        });
        if (t === a)
          await db.prisma.user.create({
            data: {
              id: colleague,
              email: 'colleague@example.invalid',
              name: 'Synthetic colleague',
              passwordHash: hash,
            },
          });
        await db.prisma.conversation.create({
          data: {
            id: conversation,
            type: 'GROUP',
            name: 'Local synthetic discussion',
            createdById: shared,
            members: {
              create: [
                { userId: shared },
                ...(t === a ? [{ userId: colleague }] : []),
              ],
            },
          },
        });
      });
    const app = require(root + '/server/dist/app').default;
    server = http.createServer(app);
    const raw = sockets.initializeSocketServer(server);
    raw.use(authenticateSocket);
    handlers.registerSocketHandlers(raw);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    base = 'http://127.0.0.1:' + server.address().port;
    let aCookie, bCookie, cCookie;
    await check(
      'real password HTTP login issues isolated persisted cookie sessions for same IDs/email',
      async () => {
        [aCookie, bCookie, cCookie] = await Promise.all([
          login(a, 'same@example.invalid', password),
          login(b, 'same@example.invalid', password),
          login(a, 'colleague@example.invalid', password),
        ]);
        assert.notEqual(aCookie, bCookie);
        assert.equal(
          (
            await query(
              "SELECT count(*) FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=ANY($1::text[])",
              [[a.id, b.id]],
            )
          ).rows[0].count,
          '3',
        );
      },
    );
    await check(
      'unauthenticated and untrusted-origin Socket.IO handshakes are rejected',
      async () => {
        await assert.rejects(socket(null), /Unauthorized/);
        await assert.rejects(
          socket(aCookie, {
            extraHeaders: {
              Origin: 'https://untrusted.example.invalid',
              Cookie: aCookie,
            },
          }),
        );
      },
    );
    const [sa, sb, sc] = await Promise.all([
      socket(aCookie, {
        auth: { tenantId: b.id, schemaName: b.schemaName },
        query: { tenantId: b.id, schemaName: b.schemaName, userId: colleague },
      }),
      socket(bCookie),
      socket(cCookie),
    ]);
    for (const s of [sa, sb, sc])
      assert.equal(
        (await ack(s, 'join_conversation', { conversationId: conversation }))
          .success,
        true,
      );
    let gotA = [],
      gotB = [],
      gotC = [];
    for (const [s, arr] of [
      [sa, gotA],
      [sb, gotB],
      [sc, gotC],
    ])
      s.on('new_message', (p) => arr.push(p));
    await check(
      'actual incoming callback persists/broadcasts only authenticated tenant despite forged auth/query selectors',
      async () => {
        const r = await ack(sa, 'send_message', {
          conversationId: conversation,
          content: 'Synthetic A message',
        });
        assert.equal(r.success, true);
        await pause();
        assert(gotA.some((m) => m.content === 'Synthetic A message'));
        assert(gotC.some((m) => m.content === 'Synthetic A message'));
        assert.equal(gotB.length, 0);
        assert.equal(
          await runWithTenant(a, () => db.prisma.message.count()),
          1,
        );
        assert.equal(
          await runWithTenant(b, () => db.prisma.message.count()),
          0,
        );
        assert(!JSON.stringify(gotA).includes('passwordHash'));
        assert(!JSON.stringify(gotA).includes('sessionVersion'));
      },
    );
    await check(
      'removed conversation member gets no private delivery despite stale joined room',
      async () => {
        await runWithTenant(a, () =>
          db.prisma.conversationMember.delete({
            where: {
              conversationId_userId: {
                conversationId: conversation,
                userId: colleague,
              },
            },
          }),
        );
        gotC.length = 0;
        const r = await ack(sa, 'send_message', {
          conversationId: conversation,
          content: 'After membership removal',
        });
        assert.equal(r.success, true);
        await pause();
        assert.equal(gotC.length, 0);
        const denied = await ack(sc, 'send_message', {
          conversationId: conversation,
          content: 'Forbidden',
        });
        assert.equal(denied.success, false);
      },
    );
    const task = await runWithTenant(a, () =>
      db.prisma.task.create({
        data: { taskName: 'Private synthetic task', createdById: shared },
      }),
    );
    let taskA = [],
      taskB = [],
      taskC = [];
    for (const [s, arr] of [
      [sa, taskA],
      [sb, taskB],
      [sc, taskC],
    ])
      s.on('task_updated', (p) => arr.push(p));
    await check(
      'task payloads match current creator/assignee/admin access, including same-tenant unrelated users',
      async () => {
        await runWithTenant(a, () =>
          sockets.emitTenantEvent('task_updated', task),
        );
        await pause();
        assert.equal(taskA.length, 1);
        assert.equal(taskB.length, 0);
        assert.equal(taskC.length, 0);
      },
    );
    await check(
      'deleted task snapshot reaches previous allowed users only',
      async () => {
        const deletedA = [],
          deletedC = [];
        sa.on('task_deleted', (x) => deletedA.push(x));
        sc.on('task_deleted', (x) => deletedC.push(x));
        await runWithTenant(a, async () => {
          await db.prisma.task.delete({ where: { id: task.id } });
          await sockets.emitTenantEvent('task_deleted', task.id, {
            taskAcl: { createdById: shared, assignedToId: null },
          });
        });
        await pause();
        assert.deepEqual(deletedA, [task.id]);
        assert.equal(deletedC.length, 0);
      },
    );
    await check(
      'atomic real PostgreSQL storage cap has one winner under concurrent reservations',
      async () => {
        const r = await Promise.allSettled([
          usage.reserveStorage(a.id, 24),
          usage.reserveStorage(a.id, 24),
        ]);
        assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
        assert.equal((await store.getTenantById(a.id)).storageBytesUsed, 24);
        assert.equal((await store.getTenantById(b.id)).storageBytesUsed, 0);
        await usage.releaseStorage(a.id, 24);
      },
    );
    await check(
      'already-connected inactive user is revoked before broadcast',
      async () => {
        await runWithTenant(a, () =>
          db.prisma.user.update({
            where: { id: colleague },
            data: { isActive: false },
          }),
        );
        const gone = disconnected(sc);
        await runWithTenant(a, () =>
          sockets.emitTenantEvent('daily_update_changed', { synthetic: true }),
        );
        await gone;
        assert.equal(sc.connected, false);
      },
    );
    await check(
      'destroyed live session prevents delivery and disconnects existing socket',
      async () => {
        await query(
          "DELETE FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=$1",
          [b.id],
        );
        const gone = disconnected(sb);
        await runWithTenant(b, () =>
          sockets.emitTenantEvent('daily_update_changed', { synthetic: true }),
        );
        await gone;
        assert.equal(sb.connected, false);
      },
    );
    await check(
      'tenant suspension disconnects existing client and invalidates handshake session',
      async () => {
        const gone = disconnected(sa);
        await store.updateTenant(a.id, { status: 'SUSPENDED' });
        await gone;
        await assert.rejects(socket(aCookie), /Unauthorized/);
      },
    );
    console.log(
      'RESULT ' +
        passed +
        ' actual PostgreSQL/HTTP-cookie/Socket.IO checks passed',
    );
  } finally {
    for (const s of clients) s.disconnect();
    await sockets.closeSocketServer();
    if (server?.listening) await new Promise((r) => server.close(r));
    await new Promise((r) => setTimeout(r, 200));
    await session.closeSessionStore();
    await require(root + '/server/dist/platform/routes').closeConsoleSessions();
    await db.disconnectPrisma();
    for (const t of owned) {
      const c = await store.getControlPool().connect();
      try {
        await c.query('BEGIN');
        await c.query('DROP SCHEMA "' + t.schemaName + '" CASCADE');
        await c.query(
          "DELETE FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=$1",
          [t.id],
        );
        await c.query('DELETE FROM ez_control.audit WHERE tenant_id=$1', [
          t.id,
        ]);
        await c.query(
          'DELETE FROM ez_control.setup_tokens WHERE tenant_id=$1',
          [t.id],
        );
        await c.query('DELETE FROM ez_control.tenants WHERE id=$1', [t.id]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      } finally {
        c.release();
      }
    }
    await store.closeControlPool();
    console.log(
      'CLEANUP owned synthetic schemas, sessions, sockets and pools removed/closed',
    );
  }
})().catch((e) => {
  console.error('FAIL ' + e.message);
  process.exitCode = 1;
});
