/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { randomUUID } from 'node:crypto';
import passport from './auth/passport-config';
import { sessionMiddleware } from './middlewares/session';
import { securityHeaders, apiLimiter } from './middlewares/security';
import { attachUser } from './auth/middleware';
import { requireTrustedOrigin } from './auth/request-security';
import { sessionTenantContext, skipsSessionIdentity } from './auth/session-context';
import consoleRoutes from './platform/routes';
import authRoutes from './auth/routes';
import userRoutes from './users/routes';
import sprintRoutes from './sprints/routes';
import taskRoutes from './tasks/routes';
import projectRoutes from './projects/routes';
import chatRoutes from './chat/routes';
import uploadRoutes from './upload/routes';
import inviteRoutes from './invites/routes';
import updatesRoutes from './updates/routes';
import notesRoutes from './notes/routes';
import summariesRoutes from './summaries/routes';
import adminRoutes from './admin/routes';
import exportRoutes from './export/routes';
import { corsConfig, serverConfig } from './config';
import { checkDatabaseConnection } from './database/client';
import { legacyServiceWorkerRoutes } from './delivery/legacy-service-worker';

const app: Express = express();
const privateJsonKeys = new Set([
  'passwordHash', 'password_hash', 'sessionVersion', 'session_version',
  'googleRefreshToken', 'googleAccessToken', 'tokenExpiresAt',
]);
app.set('json replacer', (key: string, value: unknown) => privateJsonKeys.has(key) ? undefined : value);
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId);
  next();
});

/**
 * Trust proxy (for Railway deployment)
 */
app.set('trust proxy', 1);

/**
 * Security headers and response compression
 */
app.use(securityHeaders);
app.use(compression());

/**
 * Serve the built React app in production.
 * Registered before sessions so asset requests never touch the session store
 * or the database. Hashed assets are immutable; index.html is served by the
 * SPA fallback below with no-store so new deploys show up immediately.
 */
const clientBuildPath = path.join(__dirname, '../../client/dist');
if (serverConfig.isProduction) {
  app.use(legacyServiceWorkerRoutes);
  app.use(
    express.static(clientBuildPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
}


/**
 * CORS configuration
 */
app.use(
  cors({
    origin: corsConfig.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-EZ-Workspace'],
  })
);

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store, private'); next(); });
app.use('/api', requireTrustedOrigin);

// Operator sessions have their own cookie/principal and never pass through tenant auth.
app.use('/api/console', consoleRoutes);
app.use('/api/console', (_req, res) => res.status(404).json({ success: false, error: 'Not Found' }));

// Liveness is public and must not depend on a customer session or tenant schema.
app.get(['/health', '/health/live'], (_req, res) => res.json({ success: true, status: 'healthy' }));
app.get('/health/ready', async (_req, res) => {
  const healthy = await Promise.race([checkDatabaseConnection(), new Promise<boolean>((resolve) => { const timer = setTimeout(() => resolve(false), 2000); timer.unref(); })]);
  res.status(healthy ? 200 : 503).json({ success: healthy, status: healthy ? 'ready' : 'unavailable' });
});

/**
 * Session middleware
 */
app.use(sessionMiddleware);

/**
 * Passport initialization
 */
app.use(passport.initialize());
app.use(sessionTenantContext);
const deserializeSession = passport.session();
app.use((req, res, next) => skipsSessionIdentity(req) ? next() : deserializeSession(req, res, next));

/**
 * Attach user to response locals
 */
app.use(attachUser);

/**
 * Rate limiting
 */
app.use('/api', apiLimiter);

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sync', (_req, res) => res.status(503).json({ success: false, error: 'CAPABILITY_DISABLED' }));
app.use('/api/conversations', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/drive', (_req, res) => res.status(503).json({ success: false, error: 'CAPABILITY_DISABLED' }));
app.use('/api/updates', updatesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/summaries', summariesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

/**
 * Unknown API routes return JSON, never the React app's HTML
 */
const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
};
app.use('/api', notFound);

if (serverConfig.isProduction) {
  // Handle React routing - return index.html for all other routes
  app.get('*', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  app.use(notFound);
}

/**
 * Global error handler
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Do not log provider errors/request objects which may contain credentials.
  console.error('Request failed', {
    name: err.name || 'Error',
    code: typeof err.code === 'string' && /^[A-Z0-9_]{1,24}$/.test(err.code) ? err.code : undefined,
    requestId: res.locals.requestId,
  });

  // Don't leak error details in production
  const message = serverConfig.isProduction
    ? 'An error occurred'
    : err.message || 'Internal server error';

  res.status(err.status || 500).json({
    success: false,
    requestId: res.locals.requestId,
    error: err.name || 'Error',
    message,
    ...(serverConfig.isDevelopment && { stack: err.stack }),
  });
});

export default app;
