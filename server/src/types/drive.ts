/**
 * TypeScript interfaces for Google Drive integration
 */

/**
 * Google Drive file metadata returned from Drive API
 */
export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string; // File size in bytes (as string from API)
  thumbnailLink?: string;
  webViewLink: string; // Link to open file in Drive
  webContentLink?: string; // Direct download link
  iconLink?: string; // File type icon
  createdTime: string;
  modifiedTime: string;
}

/**
 * Result of uploading a file to Drive
 */
export interface DriveUploadResult {
  fileId: string;
  metadata: DriveFileMetadata;
}

/**
 * Message attachment data structure (stored in database)
 */
export interface MessageAttachmentData {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number; // File size in bytes (as number for DB)
  thumbnailLink?: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink?: string;
}

/**
 * Upload file options
 */
export interface UploadFileOptions {
  folderId?: string;
  description?: string;
}

/**
 * Permission role types for Drive file sharing
 */
export type DrivePermissionRole = 'reader' | 'writer' | 'commenter';

/**
 * Permission result from Drive API
 */
export interface DrivePermissionResult {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
}
