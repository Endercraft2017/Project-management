/**
 * Server Entry Point
 * Starts the Express server and handles graceful shutdown
 */

import http from 'http';
import app from './app';
import { serverConfig } from './config';
import { checkDatabaseConnection, disconnectPrisma } from './database/client';
import { closeSessionStore } from './middlewares/session';
import { initializeSocketServer, closeSocketServer } from './chat/socket-server';
import { registerSocketHandlers } from './chat/socket-handlers';
import { authenticateSocket } from './chat/socket-middleware';
import { ensureControlSchema } from './platform/store';
import { closeControlPool } from './platform/pool';
import { closeConsoleSessions } from './platform/routes';

const PORT = serverConfig.port;

/**
 * Start server
 */
async function startServer() {
  try {
    await ensureControlSchema();
    // Check database connection
    console.log('🔍 Checking database connection...');
    const dbConnected = await checkDatabaseConnection();

    if (!dbConnected) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    console.log('✅ Database connected');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    const io = initializeSocketServer(server);

    // Socket.IO authentication middleware
    io.use(authenticateSocket);

    // Register Socket.IO event handlers
    registerSocketHandlers(io);

    console.log('✅ Socket.IO server initialized');

    // In-process tenantless schedulers stay off until a durable worker is available.
    // Start server (bind to :: for Railway IPv6 compatibility)
    server.listen(PORT, '::', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${serverConfig.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 WebSocket enabled`);
      console.log('Background schedulers disabled; use a tenant-aware durable worker');
    });

    let stopping = false;
    const gracefulShutdown = async (signal: string) => {
      if (stopping) return;
      stopping = true;
      console.log(`Shutdown requested: ${signal}`);
      const forced = setTimeout(() => process.exit(1), 10000);
      forced.unref();
      try {
        // Close Socket.IO first: active websocket connections must not keep the
        // HTTP close callback from running and reaching store cleanup.
        await closeSocketServer();
        await new Promise<void>((resolve, reject) => server.close((error?: NodeJS.ErrnoException) => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve();
        }));
        await closeSessionStore();
        await closeConsoleSessions();
        await disconnectPrisma();
        await closeControlPool();
        clearTimeout(forced);
        process.exit(0);
      } catch (error) {
        console.error('Shutdown failed', { name: error instanceof Error ? error.name : 'Error' });
        clearTimeout(forced);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception', { name: error.name });
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection', { name: reason instanceof Error ? reason.name : 'Error' });
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    console.error('Startup failed', { name: error instanceof Error ? error.name : 'Error' });
    process.exit(1);
  }
}

// Start the server
startServer();
