/**
 * Notes Controller
 * Request handlers for notes and reminders
 */

import { Request, Response, NextFunction } from 'express';
import * as notesService from './service';
import {
  createNoteSchema,
  updateNoteSchema,
  getNoteSchema,
  listNotesQuerySchema,
  addReminderSchema,
  updateReminderSchema,
  deleteReminderSchema,
} from './validators';
import { ZodError } from 'zod';

export class NotesController {
  /**
   * POST /api/notes
   * Create a new note
   */
  async createNote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createNoteSchema.parse(req.body);
      const userId = req.user!.id;

      const note = await notesService.createNote(userId, data);

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/notes
   * Get all notes for the authenticated user
   */
  async getUserNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listNotesQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const options = {
        search: query.search,
        tag: query.tag,
        pinned: query.pinned === 'true' ? true : query.pinned === 'false' ? false : undefined,
        limit: parseInt(query.limit),
        offset: parseInt(query.offset),
      };

      const result = await notesService.getUserNotes(userId, options);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/notes/:id
   * Get a single note by ID
   */
  async getNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = getNoteSchema.parse({ id: req.params.id });
      const userId = req.user!.id;

      const note = await notesService.getNoteById(id, userId);

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * PATCH /api/notes/:id
   * Update a note
   */
  async updateNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = getNoteSchema.parse({ id: req.params.id });
      const data = updateNoteSchema.parse(req.body);
      const userId = req.user!.id;

      const note = await notesService.updateNote(id, userId, data);

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * DELETE /api/notes/:id
   * Delete a note
   */
  async deleteNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = getNoteSchema.parse({ id: req.params.id });
      const userId = req.user!.id;

      await notesService.deleteNote(id, userId);

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      next(error);
    }
  }

  /**
   * POST /api/notes/reminders
   * Add a reminder to a note
   */
  async addReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = addReminderSchema.parse(req.body);
      const userId = req.user!.id;

      const reminder = await notesService.addReminder(userId, data);

      res.status(201).json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found or access denied')) {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('future time')) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message,
          });
        }
      }

      next(error);
    }
  }

  /**
   * PATCH /api/notes/reminders/:id
   * Update a reminder
   */
  async updateReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = deleteReminderSchema.parse({ id: req.params.id });
      const data = updateReminderSchema.parse(req.body);
      const userId = req.user!.id;

      const reminder = await notesService.updateReminder(id, userId, data);

      res.json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found or access denied')) {
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.message.includes('future time')) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message,
          });
        }
      }

      next(error);
    }
  }

  /**
   * DELETE /api/notes/reminders/:id
   * Delete a reminder
   */
  async deleteReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = deleteReminderSchema.parse({ id: req.params.id });
      const userId = req.user!.id;

      await notesService.deleteReminder(id, userId);

      res.json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message,
        });
      }

      next(error);
    }
  }
}

export const notesController = new NotesController();
