/**
 * Google OAuth2 Client Manager
 * Manages OAuth2 clients for user authentication with Google Drive API
 */

import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/database/client';
import { googleOAuthConfig } from '@/config';
import { decryptToken, encryptToken } from '@/lib/token-crypto';

// Refresh a little before expiry so a token never expires mid-request
const EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * Get OAuth2 client configured with user's tokens, refreshing the access
 * token first if it has expired
 * @param userId - User ID
 * @returns Configured OAuth2Client
 */
export async function getOAuth2Client(userId: string): Promise<OAuth2Client> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleRefreshToken: true,
      googleAccessToken: true,
      tokenExpiresAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const refreshToken = decryptToken(user.googleRefreshToken);
  if (!refreshToken) {
    throw new Error('User has not granted Drive API access. Please re-authenticate.');
  }

  const oauth2Client = new OAuth2Client(
    googleOAuthConfig.clientID,
    googleOAuthConfig.clientSecret,
    googleOAuthConfig.callbackURL
  );

  const accessToken = decryptToken(user.googleAccessToken);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
    expiry_date: user.tokenExpiresAt?.getTime(),
  });

  const tokenExpired =
    !accessToken ||
    !user.tokenExpiresAt ||
    user.tokenExpiresAt.getTime() - EXPIRY_MARGIN_MS <= Date.now();

  if (tokenExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: encryptToken(credentials.access_token) || undefined,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        },
      });
    } catch (error: any) {
      console.error(`[OAuth2Client] Failed to refresh token for user ${userId}:`, error.message);
      throw new Error('Failed to refresh access token. Please re-authenticate.');
    }
  }

  return oauth2Client;
}

/**
 * Get a valid access token for a user, refreshing it if needed
 * @param userId - User ID
 * @returns Access token
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  const oauth2Client = await getOAuth2Client(userId);
  const accessToken = oauth2Client.credentials.access_token;

  if (!accessToken) {
    throw new Error('Failed to refresh access token');
  }

  return accessToken;
}

/**
 * Check if user has valid Drive API access
 * @param userId - User ID
 * @returns true if user has valid access
 */
export async function hasValidDriveAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
    },
  });

  return !!user?.googleRefreshToken;
}
