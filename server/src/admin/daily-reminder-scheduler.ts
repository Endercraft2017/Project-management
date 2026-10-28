import prisma from "@/database/client";
import { adminSettingsService } from "./settings.service";
/** Durable idempotent in-app delivery; SMTP is a separate explicitly configured capability. */
export async function processDailyReminders(date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid reminder date");
  const config = await adminSettingsService.getAutomatedReminderConfig();
  if (!config?.enabled) return;
  const users = await prisma.user.findMany({
    where: { isActive: true },
    take: 201,
    select: { id: true },
  });
  if (users.length > 200)
    throw new Error("Reminder batch exceeds supported size");
  const updates = await prisma.dailyUpdate.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
      userId: { in: users.map((u) => u.id) },
    },
    select: { userId: true },
    take: 200,
  });
  const submitted = new Set(updates.map((u) => u.userId));
  for (const user of users)
    if (!submitted.has(user.id))
      await prisma.notification.upsert({
        where: { id: `daily-update:${date}:${user.id}` },
        update: {},
        create: {
          id: `daily-update:${date}:${user.id}`,
          userId: user.id,
          type: "UPDATE_REMINDER",
          title: "Daily update reminder",
          message: `Your daily update for ${date} has not been submitted.`,
          metadata: { missingDates: [date] },
          link: `/app?view=updates&date=${date}`,
        },
      });
}
export async function startDailyReminderScheduler(): Promise<void> {}
export function stopDailyReminderScheduler(): void {}
export async function restartDailyReminderScheduler(): Promise<void> {}
