/**
 * Passport.js Configuration
 * Google OAuth 2.0 Strategy with domain restriction
 */

import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { prisma } from '@/database/client';
import { googleOAuthConfig, adminConfig } from '@/config';
import { User, Role } from '@prisma/client';
import { normalizeEmail, isValidDomain as validateDomain } from '@/lib/email-utils';
import { encryptToken } from '@/lib/token-crypto';
import { DEFAULT_ORGANIZATION_ID } from '@/tenancy/context';
import { ensureMembership } from '@/tenancy/membership';

/**
 * Validate email domain
 */
function isValidDomain(email: string): boolean {
  return validateDomain(email);
}

/**
 * Check if user should be admin
 * Compares normalized (lowercase) emails for case-insensitive matching
 */
function shouldBeAdmin(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return adminConfig.emails.map(e => normalizeEmail(e)).includes(normalizedEmail);
}

/**
 * Configure Google OAuth Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: googleOAuthConfig.clientID,
      clientSecret: googleOAuthConfig.clientSecret,
      callbackURL: googleOAuthConfig.callbackURL,
      passReqToCallback: true,
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    } as any, // accessType and prompt are passed via auth route
    async (req, accessToken, refreshToken, profile: Profile, done: VerifyCallback) => {
      try {
        // Validate profile has email
        if (!profile.emails || profile.emails.length === 0) {
          return done(new Error('No email found in Google profile'));
        }

        const email = profile.emails[0].value;
        const name = profile.displayName || 'Unknown User';
        const picture = profile.photos?.[0]?.value || null;

        // Normalize email to lowercase for consistent comparison and storage
        const normalizedEmail = normalizeEmail(email);

        // Validate domain (server-side validation, don't trust hd parameter)
        if (!isValidDomain(normalizedEmail)) {
          return done(new Error('Email must be from @servicebay.ai domain'));
        }

        // Determine role
        const role = shouldBeAdmin(normalizedEmail) ? Role.ADMIN : Role.MEMBER;

        // Find or create user (case-insensitive lookup)
        let user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive',
            },
          },
        });

        if (user) {
          // User exists
          if (!user.isActive) {
            // Inactive user trying to login - check if they have a pending invitation (case-insensitive)
            const invitation = await prisma.teamInvite.findFirst({
              where: {
                email: {
                  equals: normalizedEmail,
                  mode: 'insensitive',
                },
                status: 'PENDING',
                expiresAt: { gt: new Date() },
              },
            });

            if (!invitation) {
              // No invitation found - they were removed and not re-invited
              return done(new Error('Your account has been deactivated. Please contact an administrator.'));
            }

            // Valid invitation found - reactivate the user with normalized email
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                email: normalizedEmail,
                name,
                picture,
                role: invitation.role, // Update to role from new invitation
                isActive: true,
                googleRefreshToken: refreshToken ? encryptToken(refreshToken) : user.googleRefreshToken,
                googleAccessToken: encryptToken(accessToken),
                tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
              },
            });

            // Join the inviting organization with the invited role
            await ensureMembership(invitation.organizationId, user.id, invitation.role);

            // Mark invitation as accepted
            await prisma.teamInvite.update({
              where: { id: invitation.id },
              data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
              },
            });

            console.log('OAuth: Reactivated user from invitation:', normalizedEmail, 'with role:', invitation.role);
          } else {
            // Update existing active user with normalized email
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                email: normalizedEmail,
                name,
                picture,
                // Don't auto-update role from admin list for existing users
                // Keep their assigned role
                googleRefreshToken: refreshToken ? encryptToken(refreshToken) : user.googleRefreshToken,
                googleAccessToken: encryptToken(accessToken),
                tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
              },
            });
            console.log('OAuth: Updated existing user:', normalizedEmail);
          }
        } else {
          // User doesn't exist - check if they're a designated admin
          const isDesignatedAdmin = shouldBeAdmin(normalizedEmail);

          if (isDesignatedAdmin) {
            // Designated admin (from config) - allow immediate creation with normalized email
            user = await prisma.user.create({
              data: {
                email: normalizedEmail,
                name,
                picture,
                role: Role.ADMIN,
                isActive: true,
                googleRefreshToken: encryptToken(refreshToken),
                googleAccessToken: encryptToken(accessToken),
                tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
              },
            });
            // Platform admins from ADMIN_EMAILS administer the original organization
            await ensureMembership(DEFAULT_ORGANIZATION_ID, user.id, Role.ADMIN);
            console.log('OAuth: Created designated admin user:', normalizedEmail);
          } else {
            // Regular user - check for pending invitation (case-insensitive)
            const invitation = await prisma.teamInvite.findFirst({
              where: {
                email: {
                  equals: normalizedEmail,
                  mode: 'insensitive',
                },
                status: 'PENDING',
                expiresAt: { gt: new Date() },
              },
            });

            if (!invitation) {
              // No invitation found - reject login
              return done(new Error('No invitation found. Please ask an admin to invite you first.'));
            }

            // Valid invitation found - create new user account with normalized email
            user = await prisma.user.create({
              data: {
                email: normalizedEmail,
                name,
                picture,
                role: invitation.role,
                isActive: true,
                googleRefreshToken: encryptToken(refreshToken),
                googleAccessToken: encryptToken(accessToken),
                tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
              },
            });
            // Join the inviting organization with the invited role
            await ensureMembership(invitation.organizationId, user.id, invitation.role);
            console.log('OAuth: Created new user from invitation:', normalizedEmail, 'with role:', invitation.role);

            // Mark invitation as accepted
            await prisma.teamInvite.update({
              where: { id: invitation.id },
              data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
              },
            });
          }
        }

        return done(null, user);
      } catch (error) {
        console.error('OAuth callback error:', error);
        return done(error as Error);
      }
    }
  )
);

/**
 * Serialize user to session
 * Only store user ID in session
 */
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 * Fetch full user data from database
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        isActive: true,
        // The oldest membership is the working organization until users can
        // switch between organizations
        memberships: {
          select: { organizationId: true, role: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    // Deleted or deactivated users are treated as signed out (401), not as a
    // server error on every request
    if (!user || !user.isActive) {
      return done(null, false);
    }

    // Every user was given a membership by the multi-tenancy migration, and
    // sign-in creates one. Falling back to the original organization keeps a
    // user created some other way (seed data, tests) inside it rather than
    // unscoped.
    const membership = user.memberships[0];
    const { memberships: _memberships, ...rest } = user;

    done(null, {
      ...rest,
      organizationId: membership?.organizationId ?? DEFAULT_ORGANIZATION_ID,
      role: membership?.role ?? user.role,
    });
  } catch (error) {
    console.error('Deserialize user error:', error);
    done(error);
  }
});

export default passport;
