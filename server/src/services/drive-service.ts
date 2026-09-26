/**
 * Google Drive Service Layer
 * Handles file uploads, permissions, and metadata operations
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import { getOAuth2Client } from './google-oauth-client';
import { prisma } from '@/database/client';
import type {
  DriveFileMetadata,
  DriveUploadResult,
  DrivePermissionRole,
} from '@/types/drive';

const CHAT_FILES_FOLDER_NAME = 'ServiceBay Chat Files';

/**
 * Upload a file to user's Google Drive
 * @param userId - User ID
 * @param file - File data (Buffer or Readable stream)
 * @param fileName - Original filename
 * @param mimeType - File MIME type
 * @param folderId - Optional parent folder ID
 * @returns Upload result with file ID and metadata
 */
export async function uploadFile(
  userId: string,
  file: Buffer | Readable,
  fileName: string,
  mimeType: string,
  folderId?: string
): Promise<DriveUploadResult> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Get or create chat folder if no folderId provided
    const targetFolderId = folderId || await getOrCreateChatFolder(userId);

    // Convert Buffer to Readable stream if needed
    const media: { mimeType: string; body: Buffer | Readable } = {
      mimeType,
      body: Buffer.isBuffer(file) ? Readable.from(file) : file,
    };

    // Determine if we need resumable upload (for files > 5MB)
    const fileSize = Buffer.isBuffer(file) ? file.length : 0;
    const useResumableUpload = fileSize > 5 * 1024 * 1024; // 5MB threshold

    console.log(`[DriveService] Uploading file "${fileName}" (${fileSize} bytes) to folder ${targetFolderId}${useResumableUpload ? ' (resumable)' : ''}`);

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media,
      fields: 'id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, iconLink, createdTime, modifiedTime',
      supportsAllDrives: false,
    });

    const fileData = response.data;

    if (!fileData.id) {
      throw new Error('File upload failed: No file ID returned');
    }

    console.log(`[DriveService] File uploaded successfully: ${fileData.id}`);

    const metadata: DriveFileMetadata = {
      id: fileData.id,
      name: fileData.name || fileName,
      mimeType: fileData.mimeType || mimeType,
      size: fileData.size || '0',
      thumbnailLink: fileData.thumbnailLink || undefined,
      webViewLink: fileData.webViewLink || '',
      webContentLink: fileData.webContentLink || undefined,
      iconLink: fileData.iconLink || undefined,
      createdTime: fileData.createdTime || new Date().toISOString(),
      modifiedTime: fileData.modifiedTime || new Date().toISOString(),
    };

    return {
      fileId: fileData.id,
      metadata,
    };
  } catch (error: any) {
    console.error('[DriveService] Upload error:', error.message);
    throw new Error(`Failed to upload file to Drive: ${error.message}`);
  }
}

/**
 * Get or create "ServiceBay Chat Files" folder
 * @param userId - User ID
 * @returns Folder ID
 */
export async function getOrCreateChatFolder(userId: string): Promise<string> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Check if folder exists
    const response = await drive.files.list({
      q: `name='${CHAT_FILES_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
      const folderId = response.data.files[0].id!;
      console.log(`[DriveService] Using existing folder: ${folderId}`);
      return folderId;
    }

    // Folder doesn't exist, create it
    console.log(`[DriveService] Creating folder "${CHAT_FILES_FOLDER_NAME}"`);

    const createResponse = await drive.files.create({
      requestBody: {
        name: CHAT_FILES_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const folderId = createResponse.data.id!;
    console.log(`[DriveService] Folder created: ${folderId}`);

    return folderId;
  } catch (error: any) {
    console.error('[DriveService] Folder creation error:', error.message);
    throw new Error(`Failed to get/create chat folder: ${error.message}`);
  }
}

/**
 * Share file with a single user
 * @param userId - Owner user ID
 * @param fileId - Google Drive file ID
 * @param userEmail - Email of user to share with
 * @param role - Permission role (default: reader)
 */
export async function shareFileWithUser(
  userId: string,
  fileId: string,
  userEmail: string,
  role: DrivePermissionRole = 'reader'
): Promise<void> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log(`[DriveService] Sharing file ${fileId} with ${userEmail} (${role})`);

    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: userEmail,
      },
      sendNotificationEmail: false, // Don't spam users with email notifications
      fields: 'id',
    });

    console.log(`[DriveService] File shared successfully with ${userEmail}`);
  } catch (error: any) {
    // Log error but don't throw - file sharing might fail for invalid emails
    console.error(`[DriveService] Failed to share with ${userEmail}:`, error.message);
  }
}

/**
 * Share file with multiple users in parallel
 * @param userId - Owner user ID
 * @param fileId - Google Drive file ID
 * @param userEmails - Array of user emails
 * @param role - Permission role (default: reader)
 */
export async function shareFileWithUsers(
  userId: string,
  fileId: string,
  userEmails: string[],
  role: DrivePermissionRole = 'reader'
): Promise<void> {
  console.log(`[DriveService] Sharing file ${fileId} with ${userEmails.length} users`);

  // Share with all users in parallel
  const sharePromises = userEmails.map((email) =>
    shareFileWithUser(userId, fileId, email, role)
  );

  await Promise.allSettled(sharePromises);

  console.log(`[DriveService] Bulk sharing completed for file ${fileId}`);
}

/**
 * Get file metadata from Drive
 * @param userId - User ID
 * @param fileId - Google Drive file ID
 * @returns File metadata
 */
export async function getFileMetadata(
  userId: string,
  fileId: string
): Promise<DriveFileMetadata> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, iconLink, createdTime, modifiedTime',
    });

    const fileData = response.data;

    return {
      id: fileData.id || fileId,
      name: fileData.name || 'Unknown',
      mimeType: fileData.mimeType || 'application/octet-stream',
      size: fileData.size || '0',
      thumbnailLink: fileData.thumbnailLink || undefined,
      webViewLink: fileData.webViewLink || '',
      webContentLink: fileData.webContentLink || undefined,
      iconLink: fileData.iconLink || undefined,
      createdTime: fileData.createdTime || new Date().toISOString(),
      modifiedTime: fileData.modifiedTime || new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[DriveService] Failed to get metadata for ${fileId}:`, error.message);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Download file content from Drive (for .md files, text files, etc.)
 * @param userId - User ID
 * @param fileId - Google Drive file ID
 * @returns File content as Buffer
 */
export async function downloadFileContent(
  userId: string,
  fileId: string
): Promise<Buffer> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error: any) {
    console.error(`[DriveService] Failed to download file ${fileId}:`, error.message);
    throw new Error(`Failed to download file content: ${error.message}`);
  }
}

/**
 * Check if user has access to a file
 * @param userId - User ID
 * @param fileId - Google Drive file ID
 * @returns true if user has access
 */
export async function checkFileAccess(
  userId: string,
  fileId: string
): Promise<boolean> {
  const auth = await getOAuth2Client(userId);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Try to get file metadata - will fail if no access
    await drive.files.get({
      fileId,
      fields: 'id',
    });

    return true;
  } catch (error: any) {
    if (error.code === 404 || error.code === 403) {
      return false;
    }

    // Other errors - log and return false
    console.error(`[DriveService] Error checking access for ${fileId}:`, error.message);
    return false;
  }
}

/**
 * Upload file with resumable upload (for large files > 5MB)
 * This is a placeholder - the actual implementation is handled in uploadFile()
 * Google APIs client library automatically uses resumable upload for large files
 */
export async function uploadLargeFile(
  userId: string,
  file: Buffer | Readable,
  fileName: string,
  mimeType: string,
  folderId?: string
): Promise<DriveUploadResult> {
  // Use the same uploadFile function - googleapis handles resumable upload automatically
  return uploadFile(userId, file, fileName, mimeType, folderId);
}
