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
import { startReminderScheduler, stopReminderScheduler } from './notes/reminder-scheduler';
import { startScheduler as startWeeklySummaryScheduler, stopScheduler as stopWeeklySummaryScheduler } from './summaries/scheduler';
import { startDailyReminderScheduler, stopDailyReminderScheduler } from './admin/daily-reminder-scheduler';

const PORT = serverConfig.port;

/**
 * Start server
 */
async function startServer() {
  try {
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

    // Start reminder scheduler
    startReminderScheduler();

    // Start weekly summary scheduler
    await startWeeklySummaryScheduler();

    // Start daily update reminder scheduler
    await startDailyReminderScheduler();

    // Start server (bind to :: for Railway IPv6 compatibility)
    server.listen(PORT, '::', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${serverConfig.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 WebSocket enabled`);
      console.log(`⏰ Reminder scheduler active`);
      console.log(`📊 Weekly summary scheduler active`);
      console.log(`🔔 Daily update reminder scheduler active`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          stopReminderScheduler();
          console.log('✅ Reminder scheduler stopped');

          stopWeeklySummaryScheduler();
          console.log('✅ Weekly summary scheduler stopped');

          stopDailyReminderScheduler();
          console.log('✅ Daily update reminder scheduler stopped');

          await closeSocketServer();
          console.log('✅ Socket.IO server closed');

          await closeSessionStore();
          console.log('✅ Session store closed');

          await disconnectPrisma();
          console.log('✅ Database disconnected');

          console.log('👋 Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
