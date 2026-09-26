/**
 * Google Drive Routes
 * REST API routes for Drive file operations
 */

import { Router } from 'express';
import { isAuthenticated } from '../auth/middleware';
import * as driveController from './controller';

const router = Router();

/**
 * GET /api/drive/files/:fileId/content
 * Download file content (for markdown/text file previews)
 */
router.get('/files/:fileId/content', isAuthenticated, driveController.getFileContent);

export default router;
