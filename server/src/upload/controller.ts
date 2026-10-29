/**
 * Upload Controller
 * Request handlers for file upload endpoints
 */

import { Request, Response, NextFunction } from 'express';
import * as uploadService from './service';
import { uploadChatAttachmentSchema, listFilesQuerySchema } from './validators';
import { ZodError } from 'zod';
import multer from 'multer';
import { UploadStorageUnavailable } from './storage-policy';

function storageUnavailable(error: unknown, res: Response): boolean {
  if (!(error instanceof UploadStorageUnavailable)) return false;
  res.status(503).json({ success: false, error: error.code, message: error.message });
  return true;
}

/**
 * Upload a generic file
 */
export async function uploadFile(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    const result = await uploadService.uploadFile(file, userId);

    res.status(201).json({
      success: true,
      data: { ...result, ...('url' in result ? { url: `${result.url}?workspaceContext=${encodeURIComponent(req.session.workspaceContext || '')}` } : {}) },
    });
  } catch (error: any) {
    if (storageUnavailable(error, res)) return;
    console.error('[Upload] Error uploading file:', error.message);

    if (error.message.includes('Unsupported file type')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to upload file',
    });
  }
}

/**
 * Import tasks from CSV/Excel file
 */
export async function importTasks(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    const result = await uploadService.importTasksFromFile(file, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (storageUnavailable(error, res)) return;
    console.error('[Upload] Error importing tasks:', error.message);

    if (
      error.message.includes('Missing required columns') ||
      error.message.includes('too many rows') ||
      error.message.includes('empty')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to import tasks',
    });
  }
}

/**
 * Upload a chat attachment
 */
export async function uploadChatAttachment(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    // Validate conversationId from body
    const data = uploadChatAttachmentSchema.parse(req.body);

    const result = await uploadService.uploadChatAttachment(
      file,
      userId,
      data.conversationId
    );

    res.status(201).json({
      success: true,
      data: { ...result, url: `${result.url}?workspaceContext=${encodeURIComponent(req.session.workspaceContext || '')}` },
    });
  } catch (error: any) {
    if (storageUnavailable(error, res)) return;
    console.error('[Upload] Error uploading chat attachment:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to upload attachment',
    });
  }
}

/**
 * Download a file
 */
export async function downloadFile(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id;

    const file = await uploadService.getFileById(fileId, userId);

    // Set headers for download
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.size.toString());

    // Stream file
    res.sendFile(file.path, (err) => {
      if (err) {
        console.error('[Upload] Error streaming file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to download file',
          });
        }
      }
    });
  } catch (error: any) {
    console.error('[Upload] Error downloading file:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'File not found',
      });
    }

    if (error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to access this file',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to download file',
    });
  }
}

/**
 * List files
 */
export async function listFiles(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // Validate query parameters
    const query = listFilesQuerySchema.parse(req.query);

    const result = await uploadService.listFiles(
      userId,
      { conversationId: query.conversationId },
      { page: query.page, limit: query.limit }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Upload] Error listing files:', error.message);

    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.issues[0].message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to list files',
    });
  }
}

/**
 * Delete a file
 */
export async function deleteFile(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id;

    const result = await uploadService.deleteFile(fileId, userId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[Upload] Error deleting file:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'File not found',
      });
    }

    if (error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to delete this file',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete file',
    });
  }
}

/**
 * Multer error handler middleware
 */
export function handleMulterError(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (storageUnavailable(error, res)) return;
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        message: 'File size exceeds limit',
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Too many files',
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error.message,
    });
  }

  // File filter error
  if (error.message && error.message.includes('Unsupported')) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: error.message,
    });
  }

  next(error);
}
