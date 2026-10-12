/**
 * Request Context Middleware
 * Gives every request an id and logs one line per API request when it ends.
 *
 * The id is returned in the X-Request-Id response header and in error
 * responses, so a user's error report can be matched to the server logs.
 * An incoming X-Request-Id (from a proxy) is reused when it looks safe.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const requestId = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Only API calls are logged; static assets and health checks would drown them
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

    logger.log(level, 'request', {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.id,
    });
  });

  next();
}
