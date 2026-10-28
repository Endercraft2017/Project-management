import { randomUUID } from "node:crypto";
import prisma from "../database/client";
import { getTenantById, listTenants } from "./store";
import { runWithTenant } from "../tenancy/context";
import {
  claimJob,
  completeJob,
  enqueueJob,
  failJob,
  forgetWorker,
  touchWorker,
  renewJob,
  DurableJob,
} from "./jobs";
import { adminSettingsService } from "../admin/settings.service";
import { processDueNoteReminders } from "../notes/reminder-scheduler";
import { processDailyReminders } from "../admin/daily-reminder-scheduler";
import { processWeeklySummaryEmail } from "../summaries/scheduler";
import { isEmailEnabled } from "../lib/email";
import { weeklySummariesService } from "../summaries/service";

export function scheduleClock(
  now: Date,
  timezone = process.env.SCHEDULER_TIMEZONE || "UTC",
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
    weekday: part("weekday").toUpperCase(),
  };
}
/** Any number of workers can scan. Unique envelope keys make the scan idempotent. */
export async function enqueueScheduledJobs(
  now = new Date(),
  signal?: AbortSignal,
): Promise<void> {
  const tenants = await listTenants();
  for (const tenant of tenants) {
    if (signal?.aborted) return;
    if (tenant.status !== "ACTIVE") continue;
    try {
      await runWithTenant(tenant, async () => {
        const due = await prisma.reminder.findFirst({
          where: {
            isCompleted: false,
            notifiedAt: null,
            remindAt: { lte: now },
          },
          select: { id: true },
        });
        if (signal?.aborted) return;
        if (due)
          await enqueueJob(
            "notes_due",
            {},
            `notes:${Math.floor(now.getTime() / 60000)}`,
          );
        const daily = await adminSettingsService.getAutomatedReminderConfig();
        const weekly = await adminSettingsService.getWeeklySummaryEmailConfig();
        // Catch the latest seven days' configured occurrences after worker downtime.
        for (let ago = 0; ago < 7; ago++) {
          if (signal?.aborted) return;
          const clock = scheduleClock(new Date(now.getTime() - ago * 86400000));
          const reached = ago > 0 || clock.time >= (daily?.sendTime || "24:00");
          if (
            daily?.enabled &&
            !["SATURDAY", "SUNDAY"].includes(clock.weekday) &&
            reached
          )
            await enqueueJob(
              "daily_reminder",
              { date: clock.date },
              `daily:${clock.date}`,
            );
          if (
            weekly?.enabled &&
            isEmailEnabled() &&
            clock.weekday === weekly.sendDay &&
            (ago > 0 || clock.time >= weekly.sendTime)
          )
            await enqueueJob(
              "weekly_summary_email",
              { date: clock.date },
              `weekly-email:${clock.date}`,
              1,
            );
        }
      });
    } catch {
      console.error("Tenant schedule scan failed", { tenantId: tenant.id });
    }
  }
}
export async function executeJob(job: DurableJob): Promise<void> {
  if (
    !job.payload ||
    typeof job.payload !== "object" ||
    Array.isArray(job.payload)
  ) {
    throw Object.assign(new Error("Invalid job payload"), {
      code: "INVALID_JOB_PAYLOAD",
    });
  }
  const tenant = await getTenantById(job.tenantId);
  if (!tenant || tenant.status !== "ACTIVE")
    throw Object.assign(new Error("Tenant unavailable"), {
      code: "TENANT_INACTIVE",
    });
  await runWithTenant(tenant, async () => {
    switch (job.kind) {
      case "notes_due":
        await processDueNoteReminders();
        break;
      case "daily_reminder":
        await processDailyReminders(String(job.payload.date || ""));
        break;
      case "summary_generate": {
        const date = job.payload.weekDate;
        const actorId = job.payload.actorId;
        const day =
          typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? new Date(`${date}T12:00:00Z`)
            : new Date(NaN);
        if (
          !Number.isFinite(day.getTime()) ||
          day.toISOString().slice(0, 10) !== date ||
          day.getUTCDay() !== 1 ||
          typeof actorId !== "string" ||
          !actorId ||
          actorId.length > 128
        ) {
          throw Object.assign(new Error("Invalid summary job"), {
            code: "INVALID_JOB_PAYLOAD",
          });
        }
        const actor = await prisma.user.findFirst({
          where: { id: actorId, isActive: true, role: "ADMIN" },
          select: { id: true },
        });
        if (!actor)
          throw Object.assign(new Error("Summary authority was revoked"), {
            code: "JOB_ACTOR_FORBIDDEN",
          });
        await weeklySummariesService.generateWeeklySummary(day);
        break;
      }
      case "weekly_summary_email":
        await processWeeklySummaryEmail(String(job.payload.date || ""));
        break;
      default:
        throw Object.assign(new Error("Unknown job kind"), {
          code: "UNKNOWN_JOB",
        });
    }
  });
}
export async function runWorkerOnce(workerId = randomUUID()): Promise<boolean> {
  const job = await claimJob(workerId);
  if (!job) return false;
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void renewJob(job)
      .then((ok) => {
        if (!ok) leaseLost = true;
      })
      .catch(() => {
        leaseLost = true;
      });
  }, 20000);
  heartbeat.unref();
  try {
    await executeJob(job);
    if (leaseLost || !(await completeJob(job)))
      throw Object.assign(new Error("Lease expired"), { code: "LEASE_LOST" });
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "JOB_FAILED";
    await failJob(job, code);
    console.error("Durable job failed", {
      jobId: job.id,
      kind: job.kind,
      code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "JOB_FAILED",
    });
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export async function runWorker(signal: AbortSignal): Promise<void> {
  if (process.env.WORKER_ENABLED !== "true")
    throw new Error("Worker is disabled; set WORKER_ENABLED=true explicitly");
  if (signal.aborted) return;
  const id = randomUUID();
  let minute = -1;
  try {
    while (!signal.aborted) {
      try {
        const nextMinute = Math.floor(Date.now() / 60000);
        if (minute !== nextMinute) {
          await touchWorker(id);
          let scanPulse: Promise<void> | undefined;
          const scanHeartbeat = setInterval(() => {
            if (!scanPulse)
              scanPulse = touchWorker(id)
                .catch(() => {
                  console.error("Worker scan heartbeat failed");
                })
                .finally(() => {
                  scanPulse = undefined;
                });
          }, 20000);
          scanHeartbeat.unref();
          try {
            await enqueueScheduledJobs(new Date(), signal);
          } finally {
            clearInterval(scanHeartbeat);
            await scanPulse;
          }
          minute = nextMinute;
        }
        if (signal.aborted) break;
        const worked = await runWorkerOnce(id);
        if (worked) continue;
      } catch {
        console.error("Durable worker iteration failed");
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 3000);
        function done() {
          clearTimeout(timer);
          signal.removeEventListener("abort", done);
          resolve();
        }
        signal.addEventListener("abort", done, { once: true });
        if (signal.aborted) done();
      });
    }
  } finally {
    await forgetWorker(id);
  }
}
