/** Refuses remote databases and creates/drops only its own random local sibling. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { resolve } from "node:path";

assert(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
const supplied = new URL(process.env.TEST_DATABASE_URL);
assert(["postgres:", "postgresql:"].includes(supplied.protocol));
assert(["localhost", "127.0.0.1", "[::1]"].includes(supplied.hostname));
assert(
  /^[a-z0-9_]+_test$/i.test(supplied.pathname.slice(1)) &&
    !supplied.searchParams.has("schema"),
);
const database = `ez_export_${randomBytes(8).toString("hex")}_test`,
  adminURL = new URL(supplied);
adminURL.pathname = "/postgres";
const admin = new Pool({ connectionString: adminURL.toString(), max: 1 });
let ownsDatabase = false,
  pool: Pool | undefined,
  server: Server | undefined,
  store: any;
const root = resolve(__dirname, ".."),
  actorId = "same-admin",
  email = "same@example.invalid";
const password = `Export-${randomBytes(20).toString("hex")}`,
  origin = "http://localhost:5173";
let base = "",
  passed = 0;
type Auth = { cookie: string; context: string };
async function check(label: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${label}`);
}
async function request(path: string, auth?: Auth, body?: unknown) {
  const headers: Record<string, string> = {
    Origin: origin,
    "X-Forwarded-Proto": "https",
  };
  if (auth) {
    headers.Cookie = auth.cookie;
    headers["X-EZ-Workspace"] = auth.context;
  }
  if (body) headers["Content-Type"] = "application/json";
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
}
async function login(code: string, member = false): Promise<Auth> {
  const response = await request("/api/auth/login", undefined, {
    tenantCode: code,
    email: member ? "member@example.invalid" : email,
    password,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const cookie = response.headers
    .getSetCookie()
    .find((s) => s.startsWith("connect.sid="))
    ?.split(";")[0];
  assert(cookie && body.workspaceContext);
  return { cookie, context: body.workspaceContext };
}
async function main() {
  await admin.query(`CREATE DATABASE "${database}"`);
  ownsDatabase = true;
  const target = new URL(supplied);
  target.pathname = `/${database}`;
  process.env.DATABASE_URL = target.toString();
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = randomBytes(48).toString("hex");
  process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString("hex");
  process.env.CLIENT_URL = origin;
  process.env.CORS_ORIGIN = origin;
  process.env.AI_ENABLED = "false";
  process.env.MAIL_ENABLED = "false";
  pool = new Pool({ connectionString: target.toString(), max: 2 });
  store = require(resolve(root, "server/dist/platform/store.js"));
  const { hashPassword } = require(
    resolve(root, "server/dist/auth/password.js"),
  );
  const { runWithTenant, validateSchemaName } = require(
    resolve(root, "server/dist/tenancy/context.js"),
  );
  const { exportWorkspace, EXPORT_MAX_ROWS, EXPORT_MAX_BYTES } = require(
    resolve(root, "server/dist/export/service.js"),
  );
  const hash = await hashPassword(password),
    companies = [];
  for (const label of ["Alpha", "Beta"]) {
    const { tenant } = await store.createTenant({
      name: `Export ${label}`,
      ownerEmail: "owner@example.invalid",
      ownerName: "Owner",
    });
    companies.push(tenant);
    const s = `"${validateSchemaName(tenant.schemaName)}"`;
    await pool.query(
      `INSERT INTO ${s}.users(id,email,name,role,"passwordHash","googleAccessToken","updatedAt") VALUES($1,$2,$3,'ADMIN',$4,'provider-secret',now()),('member','member@example.invalid','Member','MEMBER',$4,'member-provider-secret',now())`,
      [actorId, email, label, hash],
    );
    await pool.query(
      `INSERT INTO ${s}.projects(id,name,"createdById","updatedAt") VALUES('same-project',$1,$2,now())`,
      [`${label}-project`, actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.tasks(id,"taskName","projectId","createdById","updatedAt") VALUES('same-task',$1,'same-project',$2,now())`,
      [`${label}-task`, actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.notes(id,title,content,"userId","updatedAt") VALUES('note','Private','note-secret',$1,now())`,
      [actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.team_invites(id,email,token,role,status,"invitedById","expiresAt") VALUES('invite','invite@example.invalid','invite-secret','MEMBER','PENDING',$1,now()+interval '1 day')`,
      [actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.conversations(id,type,name,"createdById","updatedAt") VALUES('visible','GROUP','Visible',$1,now()),('private','DM','private-chat-secret','member',now())`,
      [actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.conversation_members(id,"conversationId","userId") VALUES('a','visible',$1),('b','visible','member'),('c','private','member')`,
      [actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.messages(id,"conversationId","senderId",content,"updatedAt") VALUES('visible-message','visible',$1,$2,now()),('private-message','private','member','private-message-secret',now()),('deleted-message','visible',$1,'deleted-message-secret',now())`,
      [actorId, `${label}-message`],
    );
    await pool.query(
      `UPDATE ${s}.messages SET "isDeleted"=true WHERE id='deleted-message'`,
    );
    await pool.query(
      `INSERT INTO ${s}.files(id,filename,"storedFilename","mimeType",size,path,"uploadedById","conversationId","messageId") VALUES('own','own.txt','stored-secret','text/plain',1,'/path-secret',$1,NULL,NULL),('foreign','foreign-file-secret','f','text/plain',1,'/f','member',NULL,NULL),('chat','visible.txt','c','text/plain',1,'/c','member','visible','visible-message'),('private','private-file-secret','p','text/plain',1,'/p','member','private','private-message')`,
      [actorId],
    );
    await pool.query(
      `INSERT INTO ${s}.message_attachments(id,"messageId","driveFileId","fileName","mimeType","fileSize","webViewLink") VALUES('visible','visible-message','drive-secret','visible.pdf','application/pdf',123,'https://example.invalid/?token=url-secret'),('private','private-message','p','private-attachment-secret','application/pdf',123,'https://example.invalid/p')`,
    );
    await pool.query(
      `INSERT INTO ${s}.files(id,filename,"storedFilename","mimeType",size,path,"uploadedById","conversationId","messageId") VALUES('mismatch','mismatched-file-secret','m','text/plain',1,'/m','member','visible','private-message'),('deleted-file','deleted-file-secret','d','text/plain',1,'/d','member','visible','deleted-message')`,
    );
    await pool.query(
      `INSERT INTO ${s}.message_attachments(id,"messageId","driveFileId","fileName","mimeType","fileSize","webViewLink") VALUES('deleted','deleted-message','d','deleted-attachment-secret','application/pdf',123,'https://example.invalid/d')`,
    );
    await pool.query(
      `INSERT INTO ${s}.weekly_summaries(id,"weekStartDate","weekEndDate","updatedAt") VALUES('summary','2026-10-19','2026-10-25',now())`,
    );
    await pool.query(
      `INSERT INTO ${s}.member_weekly_summaries(id,"weeklySummaryId","userId",summary,"impactLevel","rawUpdates") VALUES('member-summary','summary',$1,'Team summary','LOW','{"private":"raw-updates-secret"}')`,
      [actorId],
    );
  }
  server = createServer(require(resolve(root, "server/dist/app.js")).default);
  await new Promise<void>((done, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", done);
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const [a, b] = companies,
    authA = await login(a.code),
    authB = await login(b.code),
    member = await login(a.code, true);
  await check("anonymous and non-admin users cannot export", async () => {
    assert.equal((await request("/api/export/workspace")).status, 401);
    assert.equal((await request("/api/export/workspace", member)).status, 403);
  });
  let exported: any;
  await check(
    "colliding IDs and email stay isolated in real HTTP exports",
    async () => {
      for (const [auth, tenant, label, other] of [
        [authA, a, "Alpha", "Beta"],
        [authB, b, "Beta", "Alpha"],
      ] as const) {
        const r = await request("/api/export/workspace", auth);
        assert.equal(r.status, 200);
        assert.match(r.headers.get("content-disposition") || "", /attachment/);
        assert.equal(r.headers.get("cache-control"), "no-store, private");
        const text = await r.text(),
          doc = JSON.parse(text);
        exported = doc;
        assert.equal(doc.format, "ez-workspace-export/1");
        assert.equal(doc.workspace.id, tenant.id);
        assert(
          text.includes(`${label}-project`) &&
            text.includes(`${label}-task`) &&
            !text.includes(`${other}-project`),
        );
      }
    },
  );
  await check(
    "private content, credentials, provider URLs and storage paths are omitted",
    async () => {
      const text = JSON.stringify(exported);
      for (const marker of [
        "provider-secret",
        "note-secret",
        "invite-secret",
        "private-chat-secret",
        "private-message-secret",
        "deleted-message-secret",
        "stored-secret",
        "path-secret",
        "foreign-file-secret",
        "private-file-secret",
        "drive-secret",
        "url-secret",
        "private-attachment-secret",
        "mismatched-file-secret",
        "deleted-file-secret",
        "deleted-attachment-secret",
        "raw-updates-secret",
        hash,
      ])
        assert(!text.includes(marker), "Excluded content escaped allowlist");
      assert.deepEqual(
        exported.data.files.map((f: { id: string }) => f.id).sort(),
        ["chat", "own"],
      );
      assert.equal(exported.data.message_attachments.length, 1);
      assert.equal(
        exported.data.messages.find(
          (m: { id: string }) => m.id === "deleted-message",
        ).content,
        "",
      );
      assert(!("notes" in exported.data));
      assert(!("passwordHash" in exported.data.users[0]));
    },
  );
  await check(
    "fresh session version and company status are enforced",
    async () => {
      assert.equal(
        (
          await request("/api/export/workspace", {
            cookie: authA.cookie,
            context: authB.context,
          })
        ).status,
        409,
      );
      assert.equal(
        (await request("/api/export/workspace?tenantCode=" + b.code, authA))
          .status,
        400,
      );
      const s = `"${a.schemaName}"`;
      await pool!.query(
        `UPDATE ${s}.users SET "sessionVersion"=1 WHERE id=$1`,
        [actorId],
      );
      await assert.rejects(
        runWithTenant(a, () =>
          exportWorkspace({ id: actorId, sessionVersion: 0 }),
        ),
        { status: 403 },
      );
      await pool!.query(
        `UPDATE ${s}.users SET "sessionVersion"=0 WHERE id=$1`,
        [actorId],
      );
      await pool!.query(
        "UPDATE ez_control.tenants SET status='SUSPENDED' WHERE id=$1",
        [a.id],
      );
      await assert.rejects(
        runWithTenant(a, () =>
          exportWorkspace({ id: actorId, sessionVersion: 0 }),
        ),
        { status: 403 },
      );
      await pool!.query(
        "UPDATE ez_control.tenants SET status='ACTIVE' WHERE id=$1",
        [a.id],
      );
    },
  );
  await check(
    "row and byte limits refuse instead of silently truncating",
    async () => {
      const s = `"${a.schemaName}"`;
      await pool!.query(
        `INSERT INTO ${s}.tasks(id,"taskName","createdById","updatedAt") SELECT 'extra-'||n,'Extra',$1,now() FROM generate_series(1,$2)n`,
        [actorId, EXPORT_MAX_ROWS + 1],
      );
      await assert.rejects(
        runWithTenant(a, () =>
          exportWorkspace({ id: actorId, sessionVersion: 0 }),
        ),
        { status: 413, code: "EXPORT_TOO_LARGE" },
      );
      await pool!.query(`DELETE FROM ${s}.tasks WHERE id LIKE 'extra-%'`);
      await pool!.query(
        `UPDATE ${s}.tasks SET details=repeat('x',$1) WHERE id='same-task'`,
        [EXPORT_MAX_BYTES + 1],
      );
      await assert.rejects(
        runWithTenant(a, () =>
          exportWorkspace({ id: actorId, sessionVersion: 0 }),
        ),
        { status: 413, code: "EXPORT_TOO_LARGE" },
      );
      await pool!.query(
        `UPDATE ${s}.tasks SET details=NULL WHERE id='same-task'`,
      );
    },
  );
  await check(
    "credential-free completion audit and per-admin request budgets work",
    async () => {
      assert.equal((await request("/api/export/workspace", authB)).status, 200);
      assert.equal((await request("/api/export/workspace", authB)).status, 429);
      const events = await pool!.query(
        "SELECT detail FROM ez_control.audit WHERE tenant_id=$1 AND action='tenant.export_completed'",
        [b.id],
      );
      assert.equal(events.rows.length, 2);
      assert(
        events.rows.every(
          (row) =>
            Object.keys(row.detail).sort().join(",") ===
            "bytes,format,totalRows,userId",
        ),
      );
    },
  );
  console.log(
    `Completed ${passed} real PostgreSQL/HTTP export checks; no providers or customer data.`,
  );
}
async function cleanup() {
  if (server?.listening)
    await new Promise<void>((done) => server!.close(() => done()));
  for (const [path, fn] of [
    ["middlewares/session", "closeSessionStore"],
    ["platform/routes", "closeConsoleSessions"],
    ["database/client", "disconnectPrisma"],
  ] as const) {
    try {
      await require(resolve(root, `server/dist/${path}.js`))[fn]();
    } catch {
      /* May not be initialized. */
    }
  }
  await store?.closeControlPool();
  await pool?.end();
  if (ownsDatabase) await admin.query(`DROP DATABASE "${database}"`);
  await admin.end();
}
main()
  .catch((error) => {
    console.error(
      "Workspace export check failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch {
      console.error(
        "Export fixture cleanup failed; inspect owned local database.",
      );
      process.exitCode = 1;
    }
  });
