/**
 * Upload Routes
 * REST API routes for file uploads
 */

import { Router } from 'express';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import { upload, uploadCSV } from './multer-config';
import * as uploadController from './controller';
import rateLimit from 'express-rate-limit';
import { serverConfig } from '@/config';

const router = Router();

// Rate limiter for uploads (10 uploads per 15 minutes per user).
// Keyed by user, not IP, so a team behind one office IP doesn't share a budget.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many file uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  skip: () => serverConfig.isTest,
});

/**
 * POST /api/upload
 * Upload a generic file
 */
router.post(
  '/',
  isAuthenticated,
  uploadLimiter,
  upload.single('file'),
  uploadController.uploadFile
);

/**
 * POST /api/upload/tasks-import
 * Upload and parse CSV/Excel for task import (Admin only)
 */
router.post(
  '/tasks-import',
  isAuthenticated,
  isAdmin,
  uploadLimiter,
  uploadCSV.single('file'),
  uploadController.importTasks
);

/**
 * POST /api/upload/chat-attachment
 * Upload a file as chat attachment
 */
router.post(
  '/chat-attachment',
  isAuthenticated,
  uploadLimiter,
  upload.single('file'),
  uploadController.uploadChatAttachment
);

/**
 * GET /api/upload/download/:id
 * Download a file
 */
router.get('/download/:id', isAuthenticated, uploadController.downloadFile);

/**
 * GET /api/upload/files
 * List uploaded files
 */
router.get('/files', isAuthenticated, uploadController.listFiles);

/**
 * DELETE /api/upload/:id
 * Delete a file
 */
router.delete('/:id', isAuthenticated, uploadController.deleteFile);

// Multer error handler
router.use(uploadController.handleMulterError);

export default router;
