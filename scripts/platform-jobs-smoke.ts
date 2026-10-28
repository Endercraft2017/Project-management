import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const raw = process.env.TEST_DATABASE_URL;
assert(raw, "TEST_DATABASE_URL is required");
const url = new URL(raw);
assert(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    /_test$/.test(url.pathname),
  "Dedicated local _test database required",
);
process.env.DATABASE_URL = raw;
process.env.AI_ENABLED = "false";
process.env.MAIL_ENABLED = "false";
const {
  createTenant,
  getControlPool,
  closeControlPool,
  ensureControlSchema,
} = require("../server/src/platform/store");
const { runWithTenant } = require("../server/src/tenancy/context");
const { prisma, disconnectPrisma } = require("../server/src/database/client");
const usage = require("../server/src/platform/usage"),
  jobs = require("../server/src/platform/jobs");
const { runWorkerOnce } = require("../server/src/platform/worker");
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function main() {
  await ensureControlSchema();
  const pool = getControlPool();
  assert.equal(
    Number(
      (await pool.query("SELECT count(*) FROM ez_control.tenants")).rows[0]
        .count,
    ),
    0,
    "Test DB must have no tenants",
  );
  const a = (
    await createTenant({
      name: "Usage Alpha",
      ownerName: "Owner",
      ownerEmail: "owner@example.test",
      storageLimitBytes: 10,
      aiTokenLimit: 1000,
    })
  ).tenant;
  const b = (
    await createTenant({
      name: "Usage Beta",
      ownerName: "Owner",
      ownerEmail: "owner@example.test",
      storageLimitBytes: 10,
      aiTokenLimit: 0,
    })
  ).tenant;
  await check("concurrent storage reservations cannot exceed cap", async () => {
    const results = await Promise.allSettled([
      usage.reserveStorage(a.id, 7),
      usage.reserveStorage(a.id, 7),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT storage_bytes_used FROM ez_control.tenants WHERE id=$1",
            [a.id],
          )
        ).rows[0].storage_bytes_used,
      ),
      7,
    );
    await usage.releaseStorage(a.id, 7);
    await assert.rejects(usage.reserveStorage(a.id, -1));
  });
  await check(
    "AI default disabled without import crash or paid probe",
    async () => {
      const {
        openAIService,
      } = require("../server/src/services/openai.service");
      await assert.rejects(
        openAIService.generateWeeklySummary("Owner", [
          { date: "2026-10-28", content: "Synthetic update" },
        ]),
        (e: any) => e.code === "AI_DISABLED",
      );
    },
  );
  await check(
    "AI atomic reservation, concurrency, zero allowance, idempotent settlement",
    async () => {
      await assert.rejects(usage.reserveAIUsage(b.id, 1));
      const r = await usage.reserveAIUsage(a.id, 700);
      await assert.rejects(
        usage.reserveAIUsage(a.id, 1),
        (e: any) => e.code === "AI_BUSY",
      );
      await usage.settleAIUsage(r, 200);
      await usage.settleAIUsage(r, 200);
      const uncertain = await usage.reserveAIUsage(a.id, 700);
      await usage.settleAIUsage(uncertain);
      assert.equal(
        Number(
          (
            await pool.query(
              "SELECT ai_tokens_used FROM ez_control.tenants WHERE id=$1",
              [a.id],
            )
          ).rows[0].ai_tokens_used,
        ),
        900,
      );
      await assert.rejects(usage.reserveAIUsage(a.id, 101));
    },
  );
  await check("job idempotency and concurrent claims are durable", async () => {
    const ids = await runWithTenant(a, () =>
      Promise.all([
        jobs.enqueueJob("notes_due", {}, "same"),
        jobs.enqueueJob("notes_due", {}, "same"),
      ]),
    );
    assert.equal(ids[0], ids[1]);
    const claims = await Promise.all([
      jobs.claimJob(randomUUID()),
      jobs.claimJob(randomUUID()),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const job = claims.find(Boolean);
    await pool.query(
      "UPDATE ez_control.jobs SET lease_until=NOW()-INTERVAL '1 minute' WHERE id=$1",
      [job.id],
    );
    const reclaimed = await jobs.claimJob(randomUUID());
    assert.equal(reclaimed.id, job.id);
    assert.equal(await jobs.completeJob(job), false);
    assert.equal(await jobs.completeJob(reclaimed), true);
  });
  await check("suspension blocks new allocations and job enqueue", async () => {
    await pool.query(
      "UPDATE ez_control.tenants SET status='SUSPENDED' WHERE id=$1",
      [b.id],
    );
    await assert.rejects(usage.reserveStorage(b.id, 1));
    await assert.rejects(
      runWithTenant(b, () => jobs.enqueueJob("notes_due", {}, "suspended")),
    );
  });
  await check(
    "worker persists a note notification once under correct tenant",
    async () => {
      await runWithTenant(a, async () => {
        const user = await prisma.user.findFirst();
        assert(user);
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
        const note = await prisma.note.create({
          data: {
            title: "Synthetic reminder",
            content: "local smoke only",
            userId: user.id,
          },
        });
        await prisma.reminder.create({
          data: { noteId: note.id, remindAt: new Date(Date.now() - 1000) },
        });
        await jobs.enqueueJob("notes_due", {}, "persist-note");
      });
      await runWorkerOnce();
      assert.equal(
        await runWithTenant(a, () => prisma.notification.count()),
        1,
      );
      assert.equal(
        await runWithTenant(b, () => prisma.notification.count()),
        0,
      );
      await runWithTenant(a, () =>
        jobs.enqueueJob("notes_due", {}, "persist-note-again"),
      );
      await runWorkerOnce();
      assert.equal(
        await runWithTenant(a, () => prisma.notification.count()),
        1,
      );
    },
  );
  await check(
    "mail is explicitly disabled and templates escape untrusted values",
    async () => {
      const mail = require("../server/src/lib/email");
      assert.equal(
        mail.escapeEmailHtml('<img src=x onerror="x">'),
        "&lt;img src=x onerror=&quot;x&quot;&gt;",
      );
      await assert.rejects(
        mail.sendInvitationEmail(
          "test@example.test",
          "<script>",
          "token",
          "MEMBER",
        ),
        (e: any) => e.code === "EMAIL_DISABLED",
      );
    },
  );
  await check(
    "renewal refreshes readiness only for a current lease",
    async () => {
      await runWithTenant(a, () =>
        jobs.enqueueJob("notes_due", {}, "heartbeat-proof"),
      );
      const job = await jobs.claimJob(randomUUID());
      assert(job);
      await pool.query(
        "UPDATE ez_control.worker_heartbeats SET last_seen_at=NOW()-INTERVAL '5 minutes'",
      );
      assert.equal(await jobs.workerIsReady(), false);
      assert.equal(await jobs.renewJob(job), true);
      assert.equal(await jobs.workerIsReady(), true);
      await pool.query(
        "UPDATE ez_control.worker_heartbeats SET last_seen_at=NOW()-INTERVAL '5 minutes'",
      );
      await pool.query(
        "UPDATE ez_control.jobs SET lease_until=NOW()-INTERVAL '1 minute' WHERE id=$1",
        [job.id],
      );
      assert.equal(await jobs.renewJob(job), false);
      assert.equal(await jobs.workerIsReady(), false);
      const replacement = await jobs.claimJob(randomUUID());
      assert.equal(replacement.id, job.id);
      assert.equal(await jobs.renewJob(job), false);
      assert.equal(await jobs.completeJob(replacement), true);
      await jobs.forgetWorker(replacement.leaseOwner);
      assert.equal(await jobs.workerIsReady(), false);
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      await assert.rejects(
        runWithTenant(a, () =>
          jobs.enqueueJob("notes_due", circular, "bad-json"),
        ),
        /Invalid job envelope/,
      );
    },
  );
  console.log(JSON.stringify({ passed, failed: 0, externalCalls: 0 }));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    await closeControlPool();
  });
