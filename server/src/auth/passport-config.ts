/** Tenant-local identity deserialization. External login providers stay disabled
 * until their state/PKCE and tenant-binding contract is implemented. */
import passport from 'passport';
import type { Request } from 'express';
import { prisma } from '@/database/client';

passport.serializeUser((user: Express.User, done) => done(null, user.id));

passport.deserializeUser(async (req: Request, id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, picture: true, role: true, isActive: true, sessionVersion: true },
    });
    if (!user || !user.isActive || user.sessionVersion !== req.session.sessionVersion) return done(null, false);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
