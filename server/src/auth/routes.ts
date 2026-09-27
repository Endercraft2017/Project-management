/**
 * Authentication Routes
 * Handles OAuth flow, login, logout, and session management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Readable } from 'stream';
import passport from './passport-config';
import { isAuthenticated } from './middleware';
import { corsConfig } from '@/config';
import { isValidDriveFileId, setDriveFileHeaders } from '@/services/drive-file-headers';

const router = Router();

const DRIVE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    hd: 'servicebay.ai', // Hint to Google to show only @servicebay.ai accounts
    accessType: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen to get refresh token
  } as any)
);

/**
 * GET /auth/google/callback
 * Handle OAuth callback from Google
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${corsConfig.clientUrl}/login?error=auth_failed`,
    failureMessage: true,
  }),
  (req: Request, res: Response) => {
    // Save session before redirect (critical for OAuth flow)
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${corsConfig.clientUrl}/login?error=session_failed`);
      }

      // Log successful authentication
      console.log(`User authenticated: ${req.user?.email}`);

      // Successful authentication - redirect to root (React app will handle authenticated state)
      res.redirect(`${corsConfig.clientUrl}/`);
    });
  }
);

/**
 * POST /auth/logout
 * Logout user and destroy session
 */
router.post('/logout', isAuthenticated, (req: Request, res: Response, next: NextFunction) => {
  const userEmail = req.user?.email;

  req.logout((err) => {
    if (err) {
      return next(err);
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed',
          message: 'Failed to destroy session',
        });
      }

      res.clearCookie('connect.sid');

      // Log logout event
      console.log(`User logged out: ${userEmail}`);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
router.get('/me', isAuthenticated, (req: Request, res: Response) => {
  // Prevent caching of auth responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    success: true,
    user: {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      picture: req.user!.picture,
      role: req.user!.role,
    },
  });
});

/**
 * GET /auth/check
 * Check if user is authenticated (for client-side)
 */
router.get('/check', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        picture: req.user!.picture,
        role: req.user!.role,
      },
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
      user: null,
    });
  }
});

/**
 * GET /auth/google/token
 * Get current user's Google access token for Picker API
 */
router.get('/google/token', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { refreshAccessToken, hasValidDriveAccess } = await import('@/services/google-oauth-client');

    if (!(await hasValidDriveAccess(userId))) {
      return res.status(401).json({
        success: false,
        error: 'NO_DRIVE_ACCESS',
        message: 'Please re-authenticate with Google to access Drive',
        requiresReauth: true,
      });
    }

    // Returns the stored token, refreshing it first if it has expired
    const accessToken = await refreshAccessToken(userId);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Error getting Google token:', error);

    // Check if it's a refresh token error
    if (error.message && error.message.includes('refresh')) {
      return res.status(401).json({
        success: false,
        error: 'REFRESH_TOKEN_EXPIRED',
        message: 'Your Google Drive access has expired. Please re-authenticate.',
        requiresReauth: true,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get Google access token',
    });
  }
});

/**
 * GET /auth/drive/status
 * Check if user has valid Google Drive access
 */
router.get('/drive/status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { hasValidDriveAccess } = await import('@/services/google-oauth-client');
    const userId = req.user!.id;

    const hasAccess = await hasValidDriveAccess(userId);

    res.json({
      success: true,
      data: {
        hasAccess,
        requiresReauth: !hasAccess,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Error checking Drive status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to check Drive access',
    });
  }
});

/**
 * GET /auth/google/reauth
 * Trigger Google OAuth re-authentication with Drive scopes
 * This allows users to re-grant Drive permissions without logging out
 */
router.get('/google/reauth', isAuthenticated,
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    hd: 'servicebay.ai',
    accessType: 'offline',
    prompt: 'consent', // Force consent screen to get new refresh token
  } as any)
);

/**
 * POST /auth/drive/upload
 * Upload a local file to user's Google Drive in ServiceBay PM folder
 */
router.post('/drive/upload', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const multer = await import('multer');
    const { uploadFileToDrive } = await import('@/services/google-drive.service');
    const { refreshAccessToken } = await import('@/services/google-oauth-client');
    const { prisma } = await import('@/database/client');

    // Memory storage (the file goes to Drive, not disk), capped so a large
    // upload can't exhaust server memory
    const upload = multer
      .default({
        storage: multer.memoryStorage(),
        limits: { fileSize: DRIVE_UPLOAD_MAX_BYTES, files: 1 },
      })
      .single('file');

    // Parse multipart form data
    upload(req, res, async (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'FILE_TOO_LARGE',
            message: `Files can be at most ${DRIVE_UPLOAD_MAX_BYTES / (1024 * 1024)} MB`,
          });
        }
        console.error('[Auth] Multer error:', err);
        return res.status(400).json({
          success: false,
          error: 'FILE_UPLOAD_ERROR',
          message: 'Failed to process file upload',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: 'No file provided',
        });
      }

      try {
        // Get OAuth2 client for the user (handles token refresh automatically)
        const { getOAuth2Client } = await import('@/services/google-oauth-client');
        const oauth2Client = await getOAuth2Client(userId);

        // Upload file to Google Drive
        const fileData = await uploadFileToDrive(
          oauth2Client,
          req.file.originalname,
          req.file.mimetype,
          req.file.buffer
        );

        res.json({
          success: true,
          data: fileData,
        });
      } catch (uploadError: any) {
        console.error('[Auth] Drive upload error:', uploadError);

        if (uploadError.message?.includes('refresh')) {
          return res.status(401).json({
            success: false,
            error: 'REFRESH_TOKEN_EXPIRED',
            message: 'Your Google Drive access has expired. Please re-authenticate.',
            requiresReauth: true,
          });
        }

        res.status(500).json({
          success: false,
          error: 'UPLOAD_FAILED',
          message: uploadError.message || 'Failed to upload file to Google Drive',
        });
      }
    });
  } catch (error: any) {
    console.error('[Auth] Upload endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to process upload request',
    });
  }
});

/**
 * GET /auth/drive/file/:fileId
 * Proxy Drive file content with authentication
 * This allows viewing Drive files shared in chat
 * Files should have 'anyone with link' permission for receivers to view
 *
 * Only passive types (images, PDF, media, plain text) are served inline;
 * anything else is forced to download so it can never run on this origin.
 */
router.get('/drive/file/:fileId', isAuthenticated, async (req: Request, res: Response) => {
  const { fileId } = req.params;

  if (!isValidDriveFileId(fileId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_ID',
      message: 'Invalid file ID',
    });
  }

  try {
    // Try without user credentials first (files shared as 'anyone with link')
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      const base = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const key = `key=${encodeURIComponent(apiKey)}`;
      const [metadataResponse, contentResponse] = await Promise.all([
        fetch(`${base}?fields=mimeType,name&${key}`),
        fetch(`${base}?alt=media&${key}`),
      ]);

      if (metadataResponse.ok && contentResponse.ok && contentResponse.body) {
        const metadata = (await metadataResponse.json()) as { mimeType?: string; name?: string };
        setDriveFileHeaders(res, metadata.mimeType, metadata.name);
        Readable.fromWeb(contentResponse.body as any).pipe(res);
        return;
      }
    }

    // Fall back to the viewer's own Drive access
    const { google } = await import('googleapis');
    const { getOAuth2Client } = await import('@/services/google-oauth-client');
    const oauth2Client = await getOAuth2Client(req.user!.id);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const metadata = await drive.files.get({ fileId, fields: 'mimeType, name' });
    const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    setDriveFileHeaders(res, metadata.data.mimeType, metadata.data.name);
    response.data.pipe(res);
  } catch (error: any) {
    console.error('[Auth] Drive file proxy error:', error.message);

    if (res.headersSent) {
      res.end();
      return;
    }

    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'File not found or no access',
      });
    }

    res.status(500).json({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Failed to fetch file from Drive. The file may not be shared or you may not have permission.',
    });
  }
});

export default router;
