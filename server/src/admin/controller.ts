/**
 * Admin Settings Controller
 * Handles HTTP requests for system configuration
 */

import { Request, Response, NextFunction } from 'express';
import { adminSettingsService } from './settings.service';
import { missingUpdatesService } from './missing-updates.service';
import { notificationCooldownService } from './notification-cooldown.service';
import { createNotification } from '@/chat/notification-service';
import { sendDailyUpdateReminderEmail } from '@/lib/email';
import { prisma } from '@/database/client';
import {
  updateSettingSchema,
  getSettingSchema,
  weeklySummaryEmailConfigSchema,
  weeklySummaryMembersConfigSchema,
  missingUpdatesConfigSchema,
  getMissingUpdatesSchema,
  sendUpdateReminderSchema,
  automatedReminderConfigSchema,
} from './validators';
import { ZodError } from 'zod';
import { workerIsReady } from '@/platform/jobs';

import { getSocketServer } from '@/chat/socket-server';

class AdminController {
  /**
   * GET /api/admin/settings
   * List all settings
   * Admin only
   */
  async listSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await adminSettingsService.listSettings();

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/settings/:key
   * Get a specific setting
   * Admin only
   */
  async getSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = getSettingSchema.parse({ key: req.params.key });
      const setting = await adminSettingsService.getSetting(key);

      if (!setting) {
        return res.status(404).json({
          success: false,
          message: `Setting '${key}' not found`,
        });
      }

      res.json({
        success: true,
        data: setting,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/:key
   * Update a setting
   * Admin only
   */
  async updateSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const { value } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const setting = await adminSettingsService.setSetting(key, value, userId);

      res.json({
        success: true,
        data: setting,
        message: 'Setting updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid setting value',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * DELETE /api/admin/settings/:key
   * Delete a setting
   * Admin only
   */
  async deleteSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = getSettingSchema.parse({ key: req.params.key });
      await adminSettingsService.deleteSetting(key);

      res.json({
        success: true,
        message: 'Setting deleted successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/admin/settings/weekly-summary-email/config
   * Get weekly summary email configuration
   * Admin only
   */
  async getWeeklySummaryEmailConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const config = await adminSettingsService.getWeeklySummaryEmailConfig();

      if (!config) {
        // Return default config
        return res.json({
          success: true,
          data: {
            enabled: false,
            recipientEmail: '',
            sendDay: 'MONDAY',
            sendTime: '09:00',
          },
        });
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/weekly-summary-email/config
   * Update weekly summary email configuration
   * Admin only
   */
  async updateWeeklySummaryEmailConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const config = weeklySummaryEmailConfigSchema.parse(req.body);
      const setting = await adminSettingsService.setWeeklySummaryEmailConfig(
        config,
        userId
      );

      const workerReady = await workerIsReady().catch(() => false);

      res.json({
        success: true,
        data: setting,
        message: 'Email configuration saved; a configured background worker applies the schedule',
        workerReady,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/admin/settings/automated-reminder/config
   * Get automated daily reminder configuration
   * Admin only
   */
  async getAutomatedReminderConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const config = await adminSettingsService.getAutomatedReminderConfig();

      if (!config) {
        // Return default config
        return res.json({
          success: true,
          data: {
            enabled: false,
            sendTime: '21:00',
          },
        });
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/automated-reminder/config
   * Update automated daily reminder configuration
   * Admin only
   */
  async updateAutomatedReminderConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const config = automatedReminderConfigSchema.parse(req.body);
      const setting = await adminSettingsService.setAutomatedReminderConfig(
        config,
        userId
      );

      const workerReady = await workerIsReady().catch(() => false);

      res.json({
        success: true,
        data: setting,
        message: 'Reminder configuration saved; the background worker applies the schedule',
        workerReady,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/admin/settings/weekly-summary-members/config
   * Get weekly summary member selection configuration
   * Admin only
   */
  async getWeeklySummaryMembersConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const config = await adminSettingsService.getWeeklySummaryMembersConfig();

      if (!config) {
        // Return null when no config exists (all users included by default)
        return res.json({
          success: true,
          data: null,
        });
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/weekly-summary-members/config
   * Update weekly summary member selection configuration
   * Admin only
   */
  async updateWeeklySummaryMembersConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const config = weeklySummaryMembersConfigSchema.parse(req.body);
      const setting = await adminSettingsService.setWeeklySummaryMembersConfig(
        config,
        userId
      );

      res.json({
        success: true,
        data: setting,
        message: 'Member selection updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/admin/settings/missing-updates/config
   * Get missing updates tracking configuration
   * Admin only
   */
  async getMissingUpdatesConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const config = await adminSettingsService.getMissingUpdatesConfig();

      if (!config) {
        // Return default config
        return res.json({
          success: true,
          data: {
            enabled: false,
            includedUserIds: [],
            checkBusinessDaysOnly: true,
            defaultDateRange: 'current_week',
          },
        });
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/missing-updates/config
   * Update missing updates tracking configuration
   * Admin only
   */
  async updateMissingUpdatesConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const config = missingUpdatesConfigSchema.parse(req.body);
      const setting = await adminSettingsService.setMissingUpdatesConfig(
        config,
        userId
      );

      res.json({
        success: true,
        data: setting,
        message: 'Missing updates configuration updated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/admin/updates/missing
   * Get users with missing daily updates
   * Admin only
   */
  async getMissingUpdates(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { startDate, endDate } = req.query;

      // Validate query parameters if provided
      if (startDate && endDate) {
        getMissingUpdatesSchema.parse({ startDate, endDate });
      }

      const result = await missingUpdatesService.getMissingUpdates(
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date range',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * POST /api/admin/updates/send-reminder
   * Send update reminder notification to a user
   * Admin only
   */
  async sendUpdateReminder(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      console.log('[AdminController] sendUpdateReminder called');
      console.log('[AdminController] Request body:', req.body);
      console.log('[AdminController] User:', req.user?.id, req.user?.role);

      const { userId, missingDates } = sendUpdateReminderSchema.parse(req.body);

      console.log('[AdminController] Validated userId:', userId);
      console.log('[AdminController] Validated missingDates:', missingDates);

      // Check cooldown (admin notifications bypass cooldown, but we still log it)
      const canSend = notificationCooldownService.canSendNotification(userId, 'admin');
      const timeRemaining = notificationCooldownService.getTimeRemaining(userId);

      console.log('[AdminController] Cooldown check - canSend:', canSend, 'timeRemaining:', timeRemaining);

      // Send notification via WebSocket
      const io = getSocketServer();
      console.log('[AdminController] Socket server available:', !!io);

      if (io) {
        // Format missing dates for display
        const formattedDates = missingDates.map((date) => {
          const d = new Date(date);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }).join(', ');

        const notification = {
          type: 'update_reminder',
          title: 'Daily Update Reminder',
          message: `You have missing daily updates for: ${formattedDates}`,
          missingDates,
          link: '/updates',
          timestamp: new Date().toISOString(),
        };

        console.log('[AdminController] Sending notification to user:', userId);
        console.log('[AdminController] Notification:', notification);
        console.log('[AdminController] Room:', `user:${userId}`);

        // Check if user has any connected sockets
        const roomSockets = await io.in(`user:${userId}`).fetchSockets();
        console.log('[AdminController] Sockets in room:', roomSockets.length);

        if (roomSockets.length === 0) {
          console.warn('[AdminController] WARNING: User has no connected sockets! Notification will not be delivered via WebSocket.');
        } else {
          console.log('[AdminController] User has', roomSockets.length, 'connected socket(s)');
          roomSockets.forEach((socket, index) => {
            console.log(`[AdminController] Socket ${index + 1}: ${socket.id}`);
          });
        }

        // Create persistent notification in database (will appear in bell icon)
        await createNotification({
          userId,
          type: 'UPDATE_REMINDER',
          title: notification.title,
          message: notification.message,
          metadata: { missingDates },
          link: notification.link,
        });

        console.log('[AdminController] Persistent notification created in database');

        // Send email for today's date only
        const today = new Date().toISOString().split('T')[0];
        try {
          // Get user details for email
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });

          if (user && user.email) {
            console.log('[AdminController] Sending email reminder for today:', today);
            await sendDailyUpdateReminderEmail(user.email, user.name, today);
            console.log('[AdminController] Email sent successfully');
          } else {
            console.warn('[AdminController] User email not found, skipping email');
          }
        } catch (emailError) {
          console.error('[AdminController] Failed to send email:', emailError);
          // Don't fail the request if email fails
        }

        // Also send via WebSocket for real-time delivery (if user is online)
        io.to(`user:${userId}`).emit('update_reminder', notification);

        console.log('[AdminController] WebSocket notification emitted');

        // Record the notification
        notificationCooldownService.recordNotification(userId, 'admin', missingDates);

        const responseData = {
          success: true,
          message: 'Reminder notification sent successfully',
          data: {
            userId,
            missingDates,
            sentAt: new Date().toISOString(),
            cooldownBypassed: !canSend,
            timeRemainingMs: timeRemaining,
          },
        };

        console.log('[AdminController] Sending response:', responseData);

        res.json(responseData);
      } else {
        console.error('[AdminController] WebSocket server not available!');
        return res.status(500).json({
          success: false,
          message: 'WebSocket server not available',
        });
      }
    } catch (error) {
      console.error('[AdminController] Error in sendUpdateReminder:', error);

      if (error instanceof ZodError) {
        console.error('[AdminController] Validation error:', error.issues);
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: error.issues,
        });
      }

      next(error);
    }
  }
}

export const adminController = new AdminController();
