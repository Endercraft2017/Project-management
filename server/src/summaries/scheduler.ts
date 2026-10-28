import { weeklySummariesService } from "./service";
import { adminSettingsService } from "@/admin/settings.service";
import { isEmailEnabled, sendWeeklySummaryEmail } from "@/lib/email";
import { enqueueJob } from "@/platform/jobs";
import { UsageError } from "@/platform/usage";
export async function processWeeklySummaryEmail(date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid summary date");
  const config = await adminSettingsService.getWeeklySummaryEmailConfig();
  if (!config?.enabled) return;
  if (!isEmailEnabled())
    throw new UsageError(
      "Email is disabled; nothing sent",
      "EMAIL_DISABLED",
      503,
    );
  const day = new Date(`${date}T12:00:00Z`);
  let summary = await weeklySummariesService.getWeeklySummary(day);
  if (!summary)
    summary = await weeklySummariesService.generateWeeklySummary(day);
  if (summary.emailSentAt) return;
  await sendWeeklySummaryEmail(
    config.recipientEmail,
    summary.weekStartDate.toISOString().slice(0, 10),
    summary.weekEndDate.toISOString().slice(0, 10),
    summary.memberSummaries.map((s) => ({
      userName: s.user.name,
      summary: s.summary,
      impactLevel: s.impactLevel,
    })),
  );
  await weeklySummariesService.markAsEmailed(summary.id);
}
export async function startScheduler(): Promise<void> {}
export function stopScheduler(): void {}
export async function restartScheduler(): Promise<void> {}
/** Local API cron is intentionally never running. Check worker heartbeat separately. */
export function isSchedulerRunning(): boolean {
  return false;
}
export async function triggerManually(): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  // SMTP cannot guarantee exactly-once delivery after a crash. Never automatically resend uncertain attempts.
  return enqueueJob(
    "weekly_summary_email",
    { date },
    `weekly-email:${date}`,
    1,
  );
}
