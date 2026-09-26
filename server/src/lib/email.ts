/**
 * Email Service
 * Handles sending emails using Nodemailer
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  from: process.env.SMTP_FROM || `ServiceBay PM <noreply@servicebay.ai>`,
};

// Create transporter
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.warn('[Email] SMTP credentials not configured. Emails will not be sent.');
      // Return a mock transporter for development
      return {
        sendMail: async (options: any) => {
          console.log('[Email] Mock send:', options);
          return { messageId: 'mock-' + Date.now() };
        },
      } as any;
    }

    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
    });

    // Verify connection
    transporter.verify((error) => {
      if (error) {
        console.error('[Email] SMTP connection error:', error);
      } else {
        console.log('[Email] SMTP server ready');
      }
    });
  }

  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transport = getTransporter();

    const mailOptions = {
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    const info = await transport.sendMail(mailOptions);

    console.log('[Email] Sent to %s: %s', options.to, info.messageId);
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  inviteToken: string,
  role: 'ADMIN' | 'MEMBER'
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const inviteUrl = `${appUrl}/accept-invite?token=${inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 40px;
        }
        .logo {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo h1 {
          color: #2563eb;
          margin: 0;
        }
        h2 {
          color: #111827;
          margin-top: 0;
        }
        .button {
          display: inline-block;
          background: #2563eb;
          color: #ffffff !important;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 500;
        }
        .button:hover {
          background: #1d4ed8;
        }
        .info {
          background: #f3f4f6;
          border-left: 4px solid #2563eb;
          padding: 12px 16px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .warning {
          color: #dc2626;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <h1>ServiceBay PM</h1>
        </div>

        <h2>You're Invited! 🎉</h2>

        <p>Hi there,</p>

        <p><strong>${inviterName}</strong> has invited you to join the ServiceBay PM team as a <strong>${role}</strong>.</p>

        <p>ServiceBay PM is a comprehensive project management platform with task tracking, team collaboration, and real-time chat.</p>

        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </div>

        <div class="info">
          <p style="margin: 0;"><strong>What happens next?</strong></p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>Click the button above to accept your invitation</li>
            <li>Create your account or sign in with Google</li>
            <li>Start collaborating with your team immediately</li>
          </ul>
        </div>

        <p class="warning">⏰ This invitation expires in 7 days.</p>

        <p>If you weren't expecting this invitation, you can safely ignore this email.</p>

        <div class="footer">
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2563eb;">${inviteUrl}</p>
          <p>---</p>
          <p>ServiceBay PM • Project Management & Team Collaboration</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `${inviterName} invited you to join ServiceBay PM`,
    html,
  });
}

/**
 * Send invitation reminder email
 */
export async function sendInvitationReminderEmail(
  to: string,
  inviterName: string,
  inviteToken: string,
  daysRemaining: number
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const inviteUrl = `${appUrl}/accept-invite?token=${inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 30px; }
        h2 { color: #111; }
        .button { display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Reminder: Your ServiceBay PM Invitation</h2>
        <p>Hi there,</p>
        <p>This is a friendly reminder that <strong>${inviterName}</strong> invited you to join ServiceBay PM.</p>
        <div class="warning">
          <strong>⏰ Your invitation expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}!</strong>
        </div>
        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Accept Invitation Now</a>
        </div>
        <p>Don't miss out on collaborating with your team!</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Reminder: Your ServiceBay PM invitation expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    html,
  });
}

/**
 * Strip HTML tags from text (basic implementation)
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Send weekly summary email
 */
export async function sendWeeklySummaryEmail(
  to: string,
  weekStartDate: string,
  weekEndDate: string,
  summaries: Array<{
    userName: string;
    summary: string;
    impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  }>
): Promise<void> {
  // Group by impact level
  const high = summaries.filter((s) => s.impactLevel === 'HIGH');
  const medium = summaries.filter((s) => s.impactLevel === 'MEDIUM');
  const low = summaries.filter((s) => s.impactLevel === 'LOW');

  // Helper function to get impact color
  const getImpactColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return '#10b981'; // Green
      case 'MEDIUM':
        return '#f59e0b'; // Yellow
      case 'LOW':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  // Helper function to render a summary card
  const renderSummary = (item: { userName: string; summary: string; impactLevel: string }) => `
    <div style="background: #f9fafb; border-left: 4px solid ${getImpactColor(item.impactLevel)}; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="width: 12px; height: 12px; border-radius: 50%; background: ${getImpactColor(item.impactLevel)}; display: inline-block; margin-right: 8px;"></span>
        <strong style="color: #111827; font-size: 16px;">${item.userName}</strong>
      </div>
      <p style="margin: 0; color: #4b5563; line-height: 1.6;">${item.summary}</p>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f3f4f6;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 700px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
        }
        .impact-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 10px;
        }
        .badge-high {
          background: #d1fae5;
          color: #065f46;
        }
        .badge-medium {
          background: #fef3c7;
          color: #92400e;
        }
        .badge-low {
          background: #fee2e2;
          color: #991b1b;
        }
        .footer {
          background: #f9fafb;
          padding: 20px 30px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }
        .stats {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .stat {
          text-align: center;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
        }
        .empty-state {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Weekly Team Summary</h1>
          <p>${weekStartDate} to ${weekEndDate}</p>
        </div>

        <div class="content">
          <div class="stats">
            <div class="stat">
              <div class="stat-value" style="color: #10b981;">${high.length}</div>
              <div class="stat-label">High Impact</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: #f59e0b;">${medium.length}</div>
              <div class="stat-label">Medium Impact</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: #ef4444;">${low.length}</div>
              <div class="stat-label">Low Impact</div>
            </div>
          </div>

          ${
            high.length > 0
              ? `
          <div class="section">
            <h2 class="section-title">
              🌟 High Impact Updates
              <span class="impact-badge badge-high">${high.length} member${high.length === 1 ? '' : 's'}</span>
            </h2>
            ${high.map(renderSummary).join('')}
          </div>
          `
              : ''
          }

          ${
            medium.length > 0
              ? `
          <div class="section">
            <h2 class="section-title">
              ⚡ Medium Impact Updates
              <span class="impact-badge badge-medium">${medium.length} member${medium.length === 1 ? '' : 's'}</span>
            </h2>
            ${medium.map(renderSummary).join('')}
          </div>
          `
              : ''
          }

          ${
            low.length > 0
              ? `
          <div class="section">
            <h2 class="section-title">
              📝 Low Impact Updates
              <span class="impact-badge badge-low">${low.length} member${low.length === 1 ? '' : 's'}</span>
            </h2>
            ${low.map(renderSummary).join('')}
          </div>
          `
              : ''
          }

          ${
            summaries.length === 0
              ? `
          <div class="empty-state">
            <p>No team updates were submitted this week.</p>
          </div>
          `
              : ''
          }
        </div>

        <div class="footer">
          <p><strong>ServiceBay PM</strong> • Automated Weekly Summary</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;">
            This summary was generated using AI to help you stay informed about your team's progress.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Weekly Team Summary: ${weekStartDate} - ${weekEndDate}`,
    html,
  });
}

/**
 * Send daily update reminder email
 */
export async function sendDailyUpdateReminderEmail(
  to: string,
  userName: string,
  date: string // YYYY-MM-DD format
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const updateUrl = `${appUrl}/?view=updates&date=${date}`;

  // Format date for display
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f3f4f6;
        }
        .container {
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .header p {
          margin: 0;
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .message {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .message p {
          margin: 0;
          color: #92400e;
        }
        .button {
          display: inline-block;
          background: #f59e0b;
          color: #ffffff !important;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
          text-align: center;
        }
        .button:hover {
          background: #d97706;
        }
        .button-container {
          text-align: center;
        }
        .info {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 16px;
          margin: 20px 0;
          border-radius: 6px;
        }
        .footer {
          background: #f9fafb;
          padding: 20px 30px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }
        .date-highlight {
          background: #fff7ed;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
          margin: 20px 0;
        }
        .date-highlight strong {
          color: #d97706;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Daily Update Reminder</h1>
          <p>Don't forget to submit your update!</p>
        </div>

        <div class="content">
          <p>Hi <strong>${userName}</strong>,</p>

          <p>This is a friendly reminder that you haven't submitted your daily update yet.</p>

          <div class="date-highlight">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Missing update for:</p>
            <strong>${formattedDate}</strong>
          </div>

          <div class="message">
            <p><strong>📝 Please submit your update</strong></p>
            <p style="margin-top: 8px;">Share what you worked on, any blockers, and your plans. It helps the team stay aligned!</p>
          </div>

          <div class="button-container">
            <a href="${updateUrl}" class="button">Submit Daily Update</a>
          </div>

          <div class="info">
            <p style="margin: 0;"><strong>💡 Quick Tips:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>Keep it concise (2-3 sentences is fine)</li>
              <li>Focus on what matters to the team</li>
              <li>Mention any help you need</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p><strong>ServiceBay PM</strong> • Daily Update Reminder</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
            If the button doesn't work, copy and paste this link:<br/>
            <span style="color: #f59e0b; word-break: break-all;">${updateUrl}</span>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Reminder: Daily Update for ${formattedDate}`,
    html,
  });
}

export default {
  sendEmail,
  sendInvitationEmail,
  sendInvitationReminderEmail,
  sendWeeklySummaryEmail,
  sendDailyUpdateReminderEmail,
};
