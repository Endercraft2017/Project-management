/**
 * Google Drive Service
 * Handles file uploads and management in user's Google Drive
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import { OAuth2Client } from 'google-auth-library';

const SERVICEBAY_FOLDER_NAME = 'ServiceBay PM';

/**
 * Get or create ServiceBay PM folder in user's Drive
 */
async function getOrCreateServiceBayFolder(oauth2Client: OAuth2Client): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${SERVICEBAY_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      // Folder exists, return its ID
      return response.data.files[0].id!;
    }

    // Folder doesn't exist, create it
    const folderMetadata = {
      name: SERVICEBAY_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    return folder.data.id!;
  } catch (error) {
    console.error('[GoogleDrive] Error getting/creating folder:', error);
    throw new Error('Failed to access Google Drive folder');
  }
}

/**
 * Upload a file to user's Google Drive in ServiceBay PM folder
 */
export async function uploadFileToDrive(
  oauth2Client: OAuth2Client,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  iconLink: string;
}> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // Get or create ServiceBay PM folder
    const folderId = await getOrCreateServiceBayFolder(oauth2Client);

    // Create readable stream from buffer
    const fileStream = Readable.from(fileBuffer);

    // Upload file to folder
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: mimeType,
      body: fileStream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, size, webViewLink, iconLink',
    });

    const file = response.data;

    // Make file accessible (anyone with link can view)
    await drive.permissions.create({
      fileId: file.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return {
      fileId: file.id!,
      fileName: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size || '0'),
      webViewLink: file.webViewLink!,
      iconLink: file.iconLink || `https://drive-thirdparty.googleusercontent.com/16/type/${file.mimeType}`,
    };
  } catch (error) {
    console.error('[GoogleDrive] Error uploading file:', error);
    throw new Error('Failed to upload file to Google Drive');
  }
}

/**
 * Get file metadata from Google Drive
 */
export async function getFileMetadata(
  oauth2Client: OAuth2Client,
  fileId: string
): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  iconLink: string;
}> {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, webViewLink, iconLink',
    });

    const file = response.data;

    return {
      fileId: file.id!,
      fileName: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size || '0'),
      webViewLink: file.webViewLink!,
      iconLink: file.iconLink || `https://drive-thirdparty.googleusercontent.com/16/type/${file.mimeType}`,
    };
  } catch (error) {
    console.error('[GoogleDrive] Error getting file metadata:', error);
    throw new Error('Failed to get file metadata from Google Drive');
  }
}
