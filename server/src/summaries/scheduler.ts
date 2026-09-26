/**
 * Weekly Summary Scheduler
 * Automates the generation and sending of weekly summaries
 */

import cron, { ScheduledTask } from 'node-cron';
import { weeklySummariesService } from './service';
import { adminSettingsService } from '@/admin/settings.service';
import { sendWeeklySummaryEmail } from '@/lib/email';

/**
 * Map day names to cron day numbers (0-6, Sunday = 0)
 */
const DAY_TO_CRON: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/**
 * Active cron job (stored for cleanup/restart)
 */
let activeJob: ScheduledTask | null = null;

/**
 * Generate and send weekly summary
 */
async function generateAndSendSummary() {
  console.log('[Scheduler] Starting weekly summary generation...');

  try {
    // Get email configuration
    const emailConfig = await adminSettingsService.getWeeklySummaryEmailConfig();

    if (!emailConfig || !emailConfig.enabled) {
      console.log('[Scheduler] Weekly summary emails are disabled. Skipping...');
      return;
    }

    // Calculate the current week
    const today = new Date();

    console.log(`[Scheduler] Generating summary for current week containing ${today.toISOString().split('T')[0]}`);

    // Generate the summary for current week (Monday to today)
    let summary;
    try {
      summary = await weeklySummariesService.generateWeeklySummary(today);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('[Scheduler] Summary already exists (possibly from manual generation).');
        console.log('[Scheduler] Deleting old summary and regenerating with latest data...');

        // Get the existing summary to get its ID
        const existingSummary = await weeklySummariesService.getWeeklySummary(today);
        if (existingSummary) {
          // Delete the old summary
          await weeklySummariesService.deleteWeeklySummary(existingSummary.id);
          console.log('[Scheduler] Old summary deleted. Generating fresh summary with complete week data...');

          // Generate a new summary with all updates up to today
          summary = await weeklySummariesService.generateWeeklySummary(today);
        } else {
          console.error('[Scheduler] Could not find existing summary to delete');
          return;
        }
      } else {
        throw error;
      }
    }

    if (!summary) {
      console.error('[Scheduler] Failed to generate or fetch summary');
      return;
    }

    // Format date strings
    const weekStartDate = summary.weekStartDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const weekEndDate = summary.weekEndDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Prepare summary data for email
    const summaries = summary.memberSummaries.map((ms) => ({
      userName: ms.user.name,
      summary: ms.summary,
      impactLevel: ms.impactLevel,
    }));

    // Send the email
    console.log(`[Scheduler] Sending email to ${emailConfig.recipientEmail}...`);
    await sendWeeklySummaryEmail(
      emailConfig.recipientEmail,
      weekStartDate,
      weekEndDate,
      summaries
    );

    // Mark as emailed
    await weeklySummariesService.markAsEmailed(summary.id);

    console.log('[Scheduler] Weekly summary generated and sent successfully!');
  } catch (error) {
    console.error('[Scheduler] Error generating weekly summary:', error);
  }
}

/**
 * Start the scheduler based on admin settings
 */
export async function startScheduler() {
  try {
    console.log('[Scheduler] ========================================');
    console.log('[Scheduler] Attempting to start weekly summary scheduler...');

    // Get email configuration to determine schedule
    const emailConfig = await adminSettingsService.getWeeklySummaryEmailConfig();

    console.log('[Scheduler] Email configuration retrieved:', {
      exists: !!emailConfig,
      enabled: emailConfig?.enabled,
      recipientEmail: emailConfig?.recipientEmail,
      sendDay: emailConfig?.sendDay,
      sendTime: emailConfig?.sendTime,
    });

    if (!emailConfig || !emailConfig.enabled) {
      console.log('[Scheduler] ⚠️  Weekly summary emails are DISABLED. Scheduler not started.');
      console.log('[Scheduler] To enable: Go to Weekly Summaries page and configure email settings');
      console.log('[Scheduler] ========================================');
      return;
    }

    // Stop existing job if any
    if (activeJob) {
      console.log('[Scheduler] Stopping existing scheduler...');
      activeJob.stop();
      activeJob = null;
    }

    // Parse time (HH:MM format)
    const [hour, minute] = emailConfig.sendTime.split(':').map(Number);
    const dayOfWeek = DAY_TO_CRON[emailConfig.sendDay];

    // Create cron expression: "minute hour dayOfWeek * *"
    // Example: "0 9 1 * *" = Every Monday at 9:00 AM
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;

    // Get timezone - use environment variable or detect system timezone
    const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentTime = new Date().toLocaleString('en-US', { timeZone: timezone });

    console.log('[Scheduler] CONFIGURATION:');
    console.log(`[Scheduler]   Cron Expression: ${cronExpression}`);
    console.log(`[Scheduler]   Schedule: Every ${emailConfig.sendDay} at ${emailConfig.sendTime}`);
    console.log(`[Scheduler]   Timezone: ${timezone}`);
    console.log(`[Scheduler]   Current Time: ${currentTime}`);
    console.log(`[Scheduler]   Recipient: ${emailConfig.recipientEmail}`);

    // Schedule the job
    activeJob = cron.schedule(cronExpression, generateAndSendSummary, {
      timezone,
    });

    console.log('[Scheduler] ✅ Weekly summary scheduler STARTED successfully');
    console.log('[Scheduler] Will execute on next scheduled occurrence');
    console.log('[Scheduler] ========================================');
  } catch (error) {
    console.error('[Scheduler] ❌ Failed to start scheduler:', error);
    console.log('[Scheduler] ========================================');
  }
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (activeJob) {
    activeJob.stop();
    activeJob = null;
    console.log('[Scheduler] Weekly summary scheduler stopped');
  }
}

/**
 * Restart the scheduler (useful when settings change)
 */
export async function restartScheduler() {
  console.log('[Scheduler] Restarting scheduler...');
  stopScheduler();
  await startScheduler();
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return activeJob !== null;
}

/**
 * Manual trigger for testing purposes
 */
export async function triggerManually() {
  console.log('[Scheduler] Manual trigger initiated');
  await generateAndSendSummary();
}
