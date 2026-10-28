import prisma from "@/database/client";
/** Called only by the durable tenant-context worker; polling API reads persisted notifications. */
export async function processDueNoteReminders(): Promise<void> {
  const reminders = await prisma.reminder.findMany({
    where: {
      isCompleted: false,
      notifiedAt: null,
      remindAt: { lte: new Date() },
      note: { user: { isActive: true } },
    },
    take: 100,
    orderBy: { remindAt: "asc" },
    include: { note: true },
  });
  for (const reminder of reminders)
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.reminder.updateMany({
        where: {
          id: reminder.id,
          isCompleted: false,
          notifiedAt: null,
          remindAt: { lte: new Date() },
          note: { user: { isActive: true } },
        },
        data: { notifiedAt: new Date() },
      });
      if (claimed.count !== 1) return;
      await tx.notification.upsert({
        where: { id: `note-reminder:${reminder.id}` },
        update: {},
        create: {
          id: `note-reminder:${reminder.id}`,
          userId: reminder.note.userId,
          type: "SYSTEM",
          title: "Note reminder",
          message: reminder.note.title.substring(0, 200),
          metadata: { reminderId: reminder.id, noteId: reminder.noteId },
          link: "/app?view=notes",
        },
      });
    });
}
// API processes never install intervals. A separate worker owns scheduling.
export function startReminderScheduler(): void {}
export function stopReminderScheduler(): void {}
