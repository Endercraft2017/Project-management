import type { Request, Response, NextFunction } from 'express';
import { corsConfig } from '@/config';
import rateLimit from 'express-rate-limit';

const trustedOrigins = new Set([corsConfig.clientUrl, corsConfig.origin].map((value) => new URL(value).origin));

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!trustedOrigins.has(req.get('origin') || '')) {
    res.status(403).json({ success: false, error: 'UNTRUSTED_ORIGIN', message: 'Request origin is not allowed' });
    return;
  }
  next();
}

export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_ATTEMPTS', message: 'Please wait before trying again' },
});

export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${String(req.body?.tenantCode || '').trim().toUpperCase()}:${String(req.body?.email || '').trim().toLowerCase()}`,
  message: { success: false, error: 'TOO_MANY_ATTEMPTS', message: 'Please wait before trying again' },
});
