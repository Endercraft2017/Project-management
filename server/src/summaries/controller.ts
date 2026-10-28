/**
 * Weekly Summaries Controller
 * Handles HTTP requests for AI-powered weekly summaries
 */

import { Request, Response, NextFunction } from 'express';
import { weeklySummariesService } from './service';
import {
  generateWeeklySummarySchema,
  getWeeklySummarySchema,
  listWeeklySummariesSchema,
  sendSummaryEmailSchema,
} from './validators';
import { ZodError } from 'zod';
import { sendWeeklySummaryEmail } from '@/lib/email';
import { adminSettingsService } from '@/admin/settings.service';
import { isSchedulerRunning, triggerManually } from './scheduler';

class WeeklySummariesController {
  /**
   * POST /api/summaries/generate
   * Generate a weekly summary for a specific week
   * Admin only
   */
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { weekDate } = generateWeeklySummarySchema.parse(req.body);
      const summary = await weeklySummariesService.generateWeeklySummary(
        new Date(weekDate)
      );

      res.json({
        success: true,
        data: summary,
        message: 'Weekly summary generated successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.issues,
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({
            success: false,
            message: error.message,
          });
        }
      }

      next(error);
    }
  }

  /**
   * GET /api/summaries/:weekDate
   * Get weekly summary for a specific week
   * All authenticated users
   */
  async getByWeek(req: Request, res: Response, next: NextFunction) {
    try {
      const { weekDate } = getWeeklySummarySchema.parse({
        weekDate: req.params.weekDate,
      });

      const summary = await weeklySummariesService.getWeeklySummary(
        new Date(weekDate)
      );

      if (!summary) {
        return res.status(404).json({
          success: false,
          message: 'Weekly summary not found for this week',
        });
      }

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/summaries/:weekDate/grouped
   * Get weekly summary grouped by impact level
   * All authenticated users
   */
  async getGrouped(req: Request, res: Response, next: NextFunction) {
    try {
      const { weekDate } = getWeeklySummarySchema.parse({
        weekDate: req.params.weekDate,
      });

      const grouped = await weeklySummariesService.getGroupedMemberSummaries(
        new Date(weekDate)
      );

      if (!grouped) {
        return res.status(404).json({
          success: false,
          message: 'Weekly summary not found for this week',
        });
      }

      res.json({
        success: true,
        data: grouped,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/summaries
   * List all weekly summaries
   * All authenticated users
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, offset } = listWeeklySummariesSchema.parse(req.query);
      const result = await weeklySummariesService.listWeeklySummaries(
        limit,
        offset
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * DELETE /api/summaries/:id
   * Delete a weekly summary
   * Admin only
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const summaryId = req.params.id;

      await weeklySummariesService.deleteWeeklySummary(summaryId);

      res.json({
        success: true,
        message: 'Weekly summary deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/summaries/:weekDate/send-email
   * Send weekly summary email manually
   * Admin only
   */
  async sendEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { weekDate } = getWeeklySummarySchema.parse({
        weekDate: req.params.weekDate,
      });

      // Get the summary
      const summary = await weeklySummariesService.getWeeklySummary(
        new Date(weekDate)
      );

      if (!summary) {
        return res.status(404).json({
          success: false,
          message: 'Weekly summary not found for this week',
        });
      }

      // Get email configuration
      const emailConfig = await adminSettingsService.getWeeklySummaryEmailConfig();

      if (!emailConfig) {
        return res.status(400).json({
          success: false,
          message: 'Email configuration not set. Please configure in admin settings.',
        });
      }

      if (!emailConfig.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Weekly summary emails are disabled in settings.',
        });
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
      await sendWeeklySummaryEmail(
        emailConfig.recipientEmail,
        weekStartDate,
        weekEndDate,
        summaries
      );

      // Mark as emailed
      await weeklySummariesService.markAsEmailed(summary.id);

      res.json({
        success: true,
        message: `Weekly summary sent to ${emailConfig.recipientEmail}`,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format',
          errors: error.issues,
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/summaries/scheduler/status
   * Get scheduler status for debugging
   * Admin only
   */
  async getSchedulerStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const isRunning = isSchedulerRunning();
      const emailConfig = await adminSettingsService.getWeeklySummaryEmailConfig();

      res.json({
        success: true,
        data: {
          isRunning,
          emailConfig: emailConfig || null,
          timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
          currentTime: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/summaries/scheduler/trigger
   * Manually trigger the scheduler for testing
   * Admin only
   */
  async triggerScheduler(req: Request, res: Response, next: NextFunction) {
    try {
      await triggerManually();

      res.json({
        success: true,
        message: 'Scheduler triggered manually. Check logs for details.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const weeklySummariesController = new WeeklySummariesController();
