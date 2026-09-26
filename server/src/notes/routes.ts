/**
 * Notes Routes
 * API routes for personal notes and reminders
 */

import { Router } from 'express';
import { notesController } from './controller';
import { isAuthenticated } from '@/auth/middleware';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/notes
 * Create a new note
 */
router.post('/', (req, res, next) => {
  notesController.createNote(req, res, next);
});

/**
 * GET /api/notes
 * Get all notes for authenticated user
 */
router.get('/', (req, res, next) => {
  notesController.getUserNotes(req, res, next);
});

/**
 * GET /api/notes/:id
 * Get a single note by ID
 */
router.get('/:id', (req, res, next) => {
  notesController.getNote(req, res, next);
});

/**
 * PATCH /api/notes/:id
 * Update a note
 */
router.patch('/:id', (req, res, next) => {
  notesController.updateNote(req, res, next);
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete('/:id', (req, res, next) => {
  notesController.deleteNote(req, res, next);
});

/**
 * POST /api/notes/reminders
 * Add a reminder to a note
 */
router.post('/reminders', (req, res, next) => {
  notesController.addReminder(req, res, next);
});

/**
 * PATCH /api/notes/reminders/:id
 * Update a reminder
 */
router.patch('/reminders/:id', (req, res, next) => {
  notesController.updateReminder(req, res, next);
});

/**
 * DELETE /api/notes/reminders/:id
 * Delete a reminder
 */
router.delete('/reminders/:id', (req, res, next) => {
  notesController.deleteReminder(req, res, next);
});

export default router;
