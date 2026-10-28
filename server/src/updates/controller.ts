/**
 * Daily Updates Controller
 * Handles HTTP requests for daily updates
 */

import { Request, Response, NextFunction } from 'express';
import { updatesService } from './service';
import { createOrUpdateUpdateSchema, getDayUpdatesSchema } from './validators';
import { ZodError } from 'zod';
import { Document, Paragraph, TextRun, AlignmentType, Packer } from 'docx';

class UpdatesController {
  /**
   * GET /api/updates/days
   * List all days that have updates
   */
  async listDays(req: Request, res: Response, next: NextFunction) {
    try {
      const days = await updatesService.listDays();
      res.json({ success: true, data: days });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/updates/:date
   * Get all updates for a specific day
   */
  async getDayUpdates(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = getDayUpdatesSchema.parse({ date: req.params.date });
      const updates = await updatesService.getDayUpdates(new Date(date));
      res.json({ success: true, data: updates });
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
   * POST /api/updates
   * Create or update user's daily update
   */
  async createOrUpdateUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const { date, content } = createOrUpdateUpdateSchema.parse(req.body);
      const update = await updatesService.createOrUpdateUpdate(
        userId,
        new Date(date),
        content
      );

      res.json({ success: true, data: update });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.issues,
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/updates/:id
   * Delete a daily update (only own updates)
   */
  async deleteUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const updateId = req.params.id;
      const result = await updatesService.deleteUpdate(updateId, userId);

      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.message === 'Update not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/updates/user/:date
   * Get current user's update for a specific date
   */
  async getUserUpdateForDate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const { date } = getDayUpdatesSchema.parse({ date: req.params.date });
      const update = await updatesService.getUserUpdateForDate(userId, new Date(date));

      res.json({ success: true, data: update });
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
   * GET /api/updates/:date/missing-members
   * Get team members who haven't submitted updates for a specific date
   */
  async getMissingMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = getDayUpdatesSchema.parse({ date: req.params.date });
      const missingMembers = await updatesService.getMissingMembersForDate(new Date(date));
      res.json({ success: true, data: missingMembers });
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
   * GET /api/updates/:date/download
   * Download daily updates as Word document
   */
  async downloadDayUpdates(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = getDayUpdatesSchema.parse({ date: req.params.date });
      const updates = await updatesService.getDayUpdates(new Date(date));

      // Create Word document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // Title
              new Paragraph({
                text: `Daily Updates - ${new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}`,
                heading: 'Heading1',
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              // Updates
              ...updates.flatMap((update) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Name: ${update.user.name}`,
                      bold: true,
                    }),
                  ],
                  spacing: { before: 300, after: 100 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Update: `,
                      bold: true,
                    }),
                    new TextRun({
                      text: update.content,
                    }),
                  ],
                  spacing: { after: 300 },
                }),
              ]),
            ],
          },
        ],
      });

      // Generate document buffer
      const buffer = await Packer.toBuffer(doc);

      // Set headers for file download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Daily-Updates-${date}.docx"`
      );

      res.send(buffer);
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
}

export const updatesController = new UpdatesController();
