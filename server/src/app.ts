/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import passport from './auth/passport-config';
import { sessionMiddleware } from './middlewares/session';
import {
  securityHeaders,
  apiLimiter,
  mutationLimiter,
  authLimiter,
  csrfProtection,
  sanitizeInput,
} from './middlewares/security';
import { attachUser } from './auth/middleware';
import authRoutes from './auth/routes';
import userRoutes from './users/routes';
import sprintRoutes from './sprints/routes';
import taskRoutes from './tasks/routes';
import syncRoutes from './sync/routes';
import chatRoutes from './chat/routes';
import uploadRoutes from './upload/routes';
import inviteRoutes from './invites/routes';
import driveRoutes from './drive/routes';
import updatesRoutes from './updates/routes';
import notesRoutes from './notes/routes';
import summariesRoutes from './summaries/routes';
import adminRoutes from './admin/routes';
import { corsConfig, serverConfig } from './config';
import { requestContext } from './middlewares/request-context';
import { tenantContext } from './tenancy/context';
import { logger, errorFields } from './lib/logger';

const app: Express = express();

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
 * SPA fallback below with no-cache so new deploys show up immediately.
 */
const clientBuildPath = path.join(__dirname, '../../client/dist');
if (serverConfig.isProduction) {
  app.use(
    express.static(clientBuildPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
}

/**
 * Request id + one structured log line per API request
 */
app.use(requestContext);

app.use(sanitizeInput);

/**
 * CORS configuration
 */
app.use(
  cors({
    origin: corsConfig.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Session middleware
 */
app.use(sessionMiddleware);

/**
 * Passport initialization
 */
app.use(passport.initialize());
app.use(passport.session());

/**
 * Attach user to response locals
 */
app.use(attachUser);

/**
 * Scope every database query in the request to the user's organization
 */
app.use(tenantContext);

/**
 * Rate limiting and CSRF protection
 * - apiLimiter: overall budget per user (or IP when signed out)
 * - mutationLimiter: 100 writes per minute per user
 * - authLimiter: 5 failed invite-token checks per 15 minutes per IP,
 *   to stop invite tokens being guessed
 * - csrfProtection: rejects writes whose Origin isn't this app
 */
app.use('/api', apiLimiter);
app.use('/api', mutationLimiter);
app.use(['/api/invites/accept', '/api/invites/validate'], authLimiter);
app.use('/api', csrfProtection);

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: serverConfig.nodeEnv,
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/summaries', summariesRoutes);
app.use('/api/admin', adminRoutes);

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
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  app.use(notFound);
}

/**
 * Global error handler
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;

  logger.error('unhandled error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    status,
    userId: req.user?.id,
    ...errorFields(err),
  });

  // A response that already started streaming can't be replaced
  if (res.headersSent) {
    return next(err);
  }

  // Don't leak error details in production
  const message = serverConfig.isProduction
    ? 'An error occurred'
    : err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    error: err.name || 'Error',
    message,
    requestId: req.requestId,
    ...(serverConfig.isDevelopment && { stack: err.stack }),
  });
});

export default app;
