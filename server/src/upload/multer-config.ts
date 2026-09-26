/**
 * Multer Configuration
 * File upload middleware with security validations
 */

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types for general uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Text
  'text/plain',
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
];

/**
 * Sanitize filename to prevent path traversal and special character issues
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .replace(/^\./, '') // Remove leading dot
    .slice(0, 255); // Limit length
}

/**
 * File filter for general uploads
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Unsupported file extension: ${ext}`));
  }

  cb(null, true);
};

/**
 * Storage configuration for general uploads
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-sanitized.ext
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    const newFilename = `${uniqueSuffix}-${nameWithoutExt}${ext}`;

    cb(null, newFilename);
  },
});

/**
 * Main multer instance for general file uploads
 * Max size: 5MB
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Single file upload
  },
});

/**
 * File filter for CSV/Excel only
 */
const csvFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const csvMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (!csvMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Only CSV and Excel files (.csv, .xls, .xlsx) are allowed'));
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.csv', '.xls', '.xlsx'].includes(ext)) {
    return cb(new Error('Only CSV and Excel files (.csv, .xls, .xlsx) are allowed'));
  }

  cb(null, true);
};

/**
 * Multer instance for CSV/Excel uploads
 * Max size: 10MB (larger files for data import)
 */
export const uploadCSV = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

/**
 * Get upload directory path
 */
export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
