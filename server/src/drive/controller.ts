/**
 * Google Drive Controller
 * Handles Drive-related API endpoints
 */

import { Request, Response } from 'express';
import { checkFileAccess, downloadFileContent } from '../services/drive-service';

/**
 * GET /api/drive/files/:fileId/content
 * Download file content (for markdown preview, etc.)
 */
export async function getFileContent(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'File ID is required',
      });
    }

    // Check if user has access to the file
    const hasAccess = await checkFileAccess(userId, fileId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this file',
      });
    }

    // Download file content
    const content = await downloadFileContent(userId, fileId);

    // Set appropriate content type
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    return res.send(content);
  } catch (error: any) {
    console.error('[DriveController] Error fetching file content:', error);

    // Handle specific Google Drive API errors
    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'File not found or has been deleted',
      });
    }

    if (error.code === 403) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied to this file',
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch file content',
    });
  }
}
