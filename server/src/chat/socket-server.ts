/**
 * Socket.IO Server Singleton
 * Initialize and manage WebSocket server instance
 */

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { sessionMiddleware } from '@/middlewares/session';
import { corsConfig } from '@/config';

let io: SocketServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  if (io) {
    console.log('[Socket.IO] Server already initialized');
    return io;
  }

  io = new SocketServer(httpServer, {
    cors: {
      origin: corsConfig.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Share Express session with Socket.IO
  // This allows us to access req.session in socket middleware
  io.engine.use(sessionMiddleware);

  console.log('[Socket.IO] Server initialized successfully');

  return io;
}

/**
 * Get Socket.IO server instance
 */
export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized. Call initializeSocketServer first.');
  }
  return io;
}

/**
 * Get the Socket.IO server if it is running, or null (scripts, tests, workers).
 * Use this where a real-time event is optional and must not fail the request.
 */
export function getSocketServerIfRunning(): SocketServer | null {
  return io;
}

/**
 * Close Socket.IO server
 */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => {
        console.log('[Socket.IO] Server closed');
        io = null;
        resolve();
      });
    });
  }
}
