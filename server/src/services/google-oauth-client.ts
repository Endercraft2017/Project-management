/**
 * Google OAuth2 Client Manager
 * Manages OAuth2 clients for user authentication with Google Drive API
 */

import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/database/client';
import { googleOAuthConfig } from '@/config';

/**
 * Get OAuth2 client configured with user's tokens
 * @param userId - User ID
 * @returns Configured OAuth2Client
 */
export async function getOAuth2Client(userId: string): Promise<OAuth2Client> {
  // Fetch user from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      googleRefreshToken: true,
      googleAccessToken: true,
      tokenExpiresAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.googleRefreshToken) {
    throw new Error('User has not granted Drive API access. Please re-authenticate.');
  }

  // Create OAuth2 client
  const oauth2Client = new OAuth2Client(
    googleOAuthConfig.clientID,
    googleOAuthConfig.clientSecret,
    googleOAuthConfig.callbackURL
  );

  // Set credentials
  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
    access_token: user.googleAccessToken || undefined,
    expiry_date: user.tokenExpiresAt?.getTime(),
  });

  // Check if token is expired
  const now = new Date();
  const tokenExpired = !user.tokenExpiresAt || user.tokenExpiresAt <= now;

  if (tokenExpired) {
    console.log(`[OAuth2Client] Token expired for user ${user.email}, refreshing...`);

    try {
      // Refresh the access token
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update database with new token
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: credentials.access_token || undefined,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        },
      });

      console.log(`[OAuth2Client] Token refreshed successfully for user ${user.email}`);
    } catch (error: any) {
      console.error(`[OAuth2Client] Failed to refresh token for user ${user.email}:`, error.message);
      throw new Error('Failed to refresh access token. Please re-authenticate.');
    }
  }

  return oauth2Client;
}

/**
 * Refresh access token for a user
 * @param userId - User ID
 * @returns New access token
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  const oauth2Client = await getOAuth2Client(userId);

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token returned from refresh');
    }

    // Update database
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: credentials.access_token,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      },
    });

    console.log(`[OAuth2Client] Access token refreshed for user ${userId}`);
    return credentials.access_token;
  } catch (error: any) {
    console.error(`[OAuth2Client] Failed to refresh access token:`, error.message);
    throw new Error('Failed to refresh access token');
  }
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
