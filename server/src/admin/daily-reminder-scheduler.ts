/**
 * Daily Update Reminder Scheduler
 * Automates sending of daily update reminders to members who haven't submitted updates
 */

import cron, { ScheduledTask } from 'node-cron';
import { adminSettingsService } from './settings.service';
import { missingUpdatesService } from './missing-updates.service';
import { createNotification } from '@/chat/notification-service';
import { sendDailyUpdateReminderEmail } from '@/lib/email';
import { getSocketServer } from '@/chat/socket-server';
import { prisma } from '@/database/client';

/**
 * Active cron job (stored for cleanup/restart)
 */
let activeJob: ScheduledTask | null = null;

/**
 * Send daily update reminders to members who haven't submitted today
 */
async function sendDailyReminders() {
  console.log('[DailyReminderScheduler] ========================================');
  console.log('[DailyReminderScheduler] Starting daily reminder process...');

  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('[DailyReminderScheduler] Checking for missing updates on:', today);

    // Get users with missing updates for current week
    const result = await missingUpdatesService.getMissingUpdates();

    // Filter to only users who are missing today's update
    const usersToNotify = result.users.filter(user =>
      user.missingDates.includes(today)
    );

    console.log(`[DailyReminderScheduler] Found ${usersToNotify.length} user(s) missing today's update`);

    if (usersToNotify.length === 0) {
      console.log('[DailyReminderScheduler] No reminders to send. Everyone is up to date!');
      console.log('[DailyReminderScheduler] ========================================');
      return;
    }

    const io = getSocketServer();

    // Send reminders to each user
    for (const user of usersToNotify) {
      try {
        console.log(`[DailyReminderScheduler] Processing reminder for ${user.userName} (${user.userId})`);

        // Format all missing dates for webapp notification
        const formattedDates = user.missingDates.map((date) => {
          const d = new Date(date);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }).join(', ');

        // Create webapp notification (shows ALL missing dates from current week)
        const webappNotification = {
          type: 'update_reminder',
          title: 'Daily Update Reminder',
          message: `You have missing daily updates for: ${formattedDates}`,
          missingDates: user.missingDates,
          link: '/updates',
          timestamp: new Date().toISOString(),
        };

        // Create persistent notification in database
        await createNotification({
          userId: user.userId,
          type: 'UPDATE_REMINDER',
          title: webappNotification.title,
          message: webappNotification.message,
          metadata: { missingDates: user.missingDates },
          link: webappNotification.link,
        });

        console.log(`[DailyReminderScheduler] Persistent notification created for ${user.userName}`);

        // Send WebSocket notification (if user is online)
        if (io) {
          io.to(`user:${user.userId}`).emit('update_reminder', webappNotification);
          console.log(`[DailyReminderScheduler] WebSocket notification sent to ${user.userName}`);
        }

        // Send email for TODAY only
        try {
          const userDetails = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { email: true, name: true },
          });

          if (userDetails && userDetails.email) {
            await sendDailyUpdateReminderEmail(userDetails.email, userDetails.name, today);
            console.log(`[DailyReminderScheduler] Email sent to ${userDetails.email}`);
          } else {
            console.warn(`[DailyReminderScheduler] No email address for ${user.userName}, skipping email`);
          }
        } catch (emailError) {
          console.error(`[DailyReminderScheduler] Failed to send email to ${user.userName}:`, emailError);
          // Continue with other users even if one email fails
        }

        console.log(`[DailyReminderScheduler] ✅ Reminder sent successfully to ${user.userName}`);
      } catch (error) {
        console.error(`[DailyReminderScheduler] Error sending reminder to ${user.userName}:`, error);
        // Continue with other users
      }
    }

    console.log('[DailyReminderScheduler] ✅ Daily reminder process completed');
    console.log(`[DailyReminderScheduler] Sent ${usersToNotify.length} reminder(s)`);
    console.log('[DailyReminderScheduler] ========================================');
  } catch (error) {
    console.error('[DailyReminderScheduler] ❌ Error in daily reminder process:', error);
    console.log('[DailyReminderScheduler] ========================================');
  }
}

/**
 * Start the scheduler based on admin settings
 */
export async function startDailyReminderScheduler() {
  try {
    console.log('[DailyReminderScheduler] ========================================');
    console.log('[DailyReminderScheduler] Attempting to start daily reminder scheduler...');

    // Get automated reminder configuration
    const config = await adminSettingsService.getAutomatedReminderConfig();

    console.log('[DailyReminderScheduler] Configuration retrieved:', {
      exists: !!config,
      enabled: config?.enabled,
      sendTime: config?.sendTime,
    });

    if (!config || !config.enabled) {
      console.log('[DailyReminderScheduler] ⚠️  Automated daily reminders are DISABLED. Scheduler not started.');
      console.log('[DailyReminderScheduler] To enable: Go to Admin Settings > Missing Updates > Automated Reminders');
      console.log('[DailyReminderScheduler] ========================================');
      return;
    }

    // Stop existing job if any
    if (activeJob) {
      console.log('[DailyReminderScheduler] Stopping existing scheduler...');
      activeJob.stop();
      activeJob = null;
    }

    // Parse time (HH:MM format)
    const [hour, minute] = config.sendTime.split(':').map(Number);

    // Create cron expression: "minute hour * * 1-5" (Monday-Friday)
    // Example: "0 21 * * 1-5" = Every weekday at 9:00 PM
    const cronExpression = `${minute} ${hour} * * 1-5`;

    // Get timezone from environment or system
    const timezone = process.env.TZ || 'Asia/Manila'; // Default to PH timezone

    console.log('[DailyReminderScheduler] CONFIGURATION:');
    console.log(`[DailyReminderScheduler]   Cron Expression: ${cronExpression}`);
    console.log(`[DailyReminderScheduler]   Schedule: Every weekday (Mon-Fri) at ${config.sendTime}`);
    console.log(`[DailyReminderScheduler]   Timezone: ${timezone}`);

    // Schedule the job
    activeJob = cron.schedule(cronExpression, sendDailyReminders, {
      timezone,
    });

    console.log('[DailyReminderScheduler] ✅ Daily reminder scheduler STARTED successfully');
    console.log('[DailyReminderScheduler] Will execute on next scheduled occurrence');
    console.log('[DailyReminderScheduler] ========================================');
  } catch (error) {
    console.error('[DailyReminderScheduler] ❌ Failed to start scheduler:', error);
    console.log('[DailyReminderScheduler] ========================================');
  }
}

/**
 * Stop the scheduler
 */
export function stopDailyReminderScheduler() {
  if (activeJob) {
    activeJob.stop();
    activeJob = null;
    console.log('[DailyReminderScheduler] Scheduler stopped');
  }
}

/**
 * Restart the scheduler (useful when settings change)
 */
export async function restartDailyReminderScheduler() {
  console.log('[DailyReminderScheduler] Restarting scheduler...');
  stopDailyReminderScheduler();
  await startDailyReminderScheduler();
}
