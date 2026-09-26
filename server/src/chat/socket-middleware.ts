/**
 * Socket.IO Middleware
 * Authentication and authorization for WebSocket connections
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';

/**
 * Extend Socket type to include userId
 */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
}

/**
 * Authenticate socket connection using Express session
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: ExtendedError) => void
) {
  try {
    // Access session from socket request
    const session = (socket.request as any).session;

    // Check if session exists and has passport user
    if (!session || !session.passport || !session.passport.user) {
      console.log('[Socket.IO] Authentication failed: No session or user');
      return next(new Error('Unauthorized'));
    }

    const userId = session.passport.user;

    // Verify user exists in database
    const { default: prisma } = await import('@/database/client');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      console.log('[Socket.IO] Authentication failed: User not found or inactive');
      return next(new Error('User not found or inactive'));
    }

    // Attach user info to socket
    (socket as AuthenticatedSocket).userId = user.id;
    (socket as AuthenticatedSocket).userName = user.name;

    console.log(`[Socket.IO] User ${user.name} (${user.id}) authenticated`);
    next();
  } catch (error: any) {
    console.error('[Socket.IO] Authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
}

/**
 * Rate limiter for socket events
 * Prevents spam and abuse
 */
export class SocketRateLimiter {
  private events: Map<string, number[]> = new Map();
  private maxEvents: number;
  private windowMs: number;

  constructor(maxEvents: number = 30, windowMs: number = 60000) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
  }

  /**
   * Check if event is allowed
   */
  check(socketId: string): boolean {
    const now = Date.now();
    const events = this.events.get(socketId) || [];

    // Remove old events outside window
    const recentEvents = events.filter((timestamp) => now - timestamp < this.windowMs);

    // Check if limit exceeded
    if (recentEvents.length >= this.maxEvents) {
      return false;
    }

    // Add current event
    recentEvents.push(now);
    this.events.set(socketId, recentEvents);

    return true;
  }

  /**
   * Clear events for socket (on disconnect)
   */
  clear(socketId: string) {
    this.events.delete(socketId);
  }

  /**
   * Clean up old entries periodically
   */
  cleanup() {
    const now = Date.now();
    for (const [socketId, events] of this.events.entries()) {
      const recentEvents = events.filter((timestamp) => now - timestamp < this.windowMs);
      if (recentEvents.length === 0) {
        this.events.delete(socketId);
      } else {
        this.events.set(socketId, recentEvents);
      }
    }
  }
}

// Create global rate limiter instances
export const messageRateLimiter = new SocketRateLimiter(30, 60000); // 30 messages per minute
export const typingRateLimiter = new SocketRateLimiter(60, 60000); // 60 typing events per minute

// Cleanup every 5 minutes
setInterval(() => {
  messageRateLimiter.cleanup();
  typingRateLimiter.cleanup();
}, 5 * 60 * 1000);
