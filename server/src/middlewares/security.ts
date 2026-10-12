/**
 * Security Middleware
 * CSRF protection, rate limiting, and security headers
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { corsConfig, rateLimitConfig, serverConfig } from '@/config';

/**
 * Security headers using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: [
        "'self'",
        'https://apis.google.com',           // Google Picker API
        'https://accounts.google.com',        // Google Sign-In
        'https://*.googleapis.com',           // Other Google APIs
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:',                             // Allow all HTTPS images (for Drive thumbnails)
      ],
      connectSrc: [
        "'self'",
        'https://apis.google.com',            // Google API calls
        'https://accounts.google.com',         // Google Auth
        'https://*.googleapis.com',            // Google services
        'https://www.googleapis.com',          // Google Drive API
      ],
      fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "'self'",
        'https://docs.google.com',             // Google Docs preview
        'https://drive.google.com',            // Google Drive picker/preview
        'https://*.google.com',                // Other Google services
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Rate limiter for general API requests
 * More lenient for authenticated users, uses user ID as key
 */
export const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs, // 15 minutes
  max: rateLimitConfig.maxRequests, // 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: 'draft-8', // Use combined RateLimit header (2025 best practice)
  legacyHeaders: false,
  // Use user ID for authenticated requests, IP for anonymous
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.id || req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return serverConfig.isTest;
  },
});

/**
 * Stricter rate limiter for read-heavy endpoints (queries)
 * Prevents excessive polling/refetching
 */
export const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second avg)
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests, please slow down',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.id || req.ip || 'unknown';
  },
  skip: (req) => serverConfig.isTest,
});

/**
 * Lenient rate limiter for mutation endpoints (create/update/delete)
 * These are less frequent and shouldn't be heavily restricted
 */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 mutations per minute
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many update requests, please slow down',
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.id || req.ip || 'unknown';
  },
  // Only writes count toward this limit
  skip: (req) => serverConfig.isTest || ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return serverConfig.isTest;
  },
});

/**
 * Reduce a URL to its origin ("https://host:port"), or null if it isn't a URL
 */
function toOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection by Origin check, on top of SameSite=lax session cookies.
 *
 * Browsers send an Origin header on cross-site requests that change state.
 * A request is allowed when it has no Origin (same-origin form posts from
 * older browsers, server-to-server calls, tests), or when its Origin is the
 * configured client URL, the CORS origin, or this server's own origin
 * (the app is served same-origin in production, possibly on a custom domain).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Reads can't change state; in development the client runs on another port
  if (SAFE_METHODS.has(req.method) || serverConfig.isDevelopment) {
    return next();
  }

  const origin = req.get('origin');
  if (!origin) {
    return next();
  }

  const allowedOrigins = [
    toOrigin(corsConfig.clientUrl),
    toOrigin(corsConfig.origin),
    toOrigin(`${req.protocol}://${req.get('host')}`),
  ];

  if (!allowedOrigins.includes(toOrigin(origin))) {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Invalid origin',
    });
    return;
  }

  next();
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Basic sanitization - remove script tags
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        obj[key] = sanitize(obj[key]);
      });
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}

/**
 * Error handler for rate limit errors
 */
export function rateLimitErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err.status === 429) {
    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: err.retryAfter,
    });
  } else {
    next(err);
  }
}
