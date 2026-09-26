/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import passport from './auth/passport-config';
import { sessionMiddleware } from './middlewares/session';
import { securityHeaders, apiLimiter, sanitizeInput } from './middlewares/security';
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

const app: Express = express();

/**
 * Trust proxy (for Railway deployment)
 */
app.set('trust proxy', 1);

/**
 * Security middleware
 */
app.use(securityHeaders);
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
 * Rate limiting
 */
app.use('/api', apiLimiter);

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
 * Serve static files from React app in production
 */
if (serverConfig.isProduction) {
  const clientBuildPath = path.join(__dirname, '../../client/dist');

  // Serve static files
  app.use(express.static(clientBuildPath));

  // Handle React routing - return index.html for all other routes
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  /**
   * 404 handler for development
   */
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });
}

/**
 * Global error handler
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const message = serverConfig.isProduction
    ? 'An error occurred'
    : err.message || 'Internal server error';

  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'Error',
    message,
    ...(serverConfig.isDevelopment && { stack: err.stack }),
  });
});

export default app;
