/**
 * Reminder Scheduler
 * Checks for due reminders and sends notifications
 */

import { getDueReminders, markReminderNotified } from './service';
import { getSocketServer } from '@/chat/socket-server';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Check for due reminders and send notifications
 */
async function checkReminders() {
  try {
    const dueReminders = await getDueReminders();

    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[ReminderScheduler] Found ${dueReminders.length} due reminders`);

    const io = getSocketServer();
    if (!io) {
      console.error('[ReminderScheduler] Socket.IO server not available');
      return;
    }

    for (const reminder of dueReminders) {
      try {
        // Send notification to user's personal room
        io.to(`user:${reminder.note.userId}`).emit('reminder_notification', {
          reminderId: reminder.id,
          noteId: reminder.noteId,
          noteTitle: reminder.note.title,
          noteContent: reminder.note.content.substring(0, 200), // First 200 chars
          remindAt: reminder.remindAt,
        });

        // Mark as notified
        await markReminderNotified(reminder.id);

        console.log(
          `[ReminderScheduler] Sent reminder ${reminder.id} to user ${reminder.note.user.name}`
        );
      } catch (error) {
        console.error(
          `[ReminderScheduler] Failed to process reminder ${reminder.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error('[ReminderScheduler] Error checking reminders:', error);
  }
}

/**
 * Start the reminder scheduler
 * Checks every minute for due reminders
 */
export function startReminderScheduler() {
  if (schedulerInterval) {
    console.warn('[ReminderScheduler] Scheduler already running');
    return;
  }

  console.log('[ReminderScheduler] Starting reminder scheduler (check every 1 minute)');

  // Check immediately on start
  checkReminders();

  // Then check every minute
  schedulerInterval = setInterval(checkReminders, 60 * 1000); // 1 minute
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ReminderScheduler] Scheduler stopped');
  }
}
