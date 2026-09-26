/**
 * Socket.IO Client Singleton
 * Manages WebSocket connection for real-time features
 */

import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '@/types';

let socket: Socket | null = null;

/**
 * Initialize Socket.IO connection
 */
export function initializeSocket(): Socket {
  if (socket) {
    return socket;
  }

  // Use empty string in production to connect to same domain, localhost in dev
  const SOCKET_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000');

  socket = io(SOCKET_URL, {
    withCredentials: true, // Important for session cookies
    transports: ['websocket', 'polling'],
    autoConnect: false, // Manual connection control
  });

  // Connection event listeners
  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('error', (error: { message: string }) => {
    console.error('Socket error:', error.message);
  });

  return socket;
}

/**
 * Get existing socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Connect to Socket.IO server
 */
export function connectSocket(): void {
  if (!socket) {
    initializeSocket();
  }
  socket?.connect();
}

/**
 * Disconnect from Socket.IO server
 */
export function disconnectSocket(): void {
  socket?.disconnect();
}

/**
 * Type-safe socket event emitter
 */
export function emit<K extends keyof SocketEvents>(
  event: K,
  ...args: Parameters<SocketEvents[K]>
): void {
  socket?.emit(event, ...args);
}

/**
 * Type-safe socket event listener
 */
export function on<K extends keyof SocketEvents>(
  event: K,
  callback: SocketEvents[K]
): void {
  socket?.on(event as string, callback as any);
}

/**
 * Type-safe socket event listener (once)
 */
export function once<K extends keyof SocketEvents>(
  event: K,
  callback: SocketEvents[K]
): void {
  socket?.once(event as string, callback as any);
}

/**
 * Remove socket event listener
 */
export function off<K extends keyof SocketEvents>(
  event: K,
  callback?: SocketEvents[K]
): void {
  if (callback) {
    socket?.off(event as string, callback as any);
  } else {
    socket?.off(event as string);
  }
}

/**
 * Join a conversation room
 */
export function joinConversation(conversationId: string): void {
  emit('join_conversation', { conversationId });
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId: string): void {
  emit('leave_conversation', { conversationId });
}

/**
 * Send a message
 */
export function sendMessage(
  conversationId: string,
  content: string,
  callback?: (response: any) => void
): void {
  socket?.emit('send_message', { conversationId, content }, callback);
}

/**
 * Edit a message
 */
export function editMessage(
  messageId: string,
  content: string,
  callback?: (response: any) => void
): void {
  socket?.emit('edit_message', { messageId, content }, callback);
}

/**
 * Delete a message
 */
export function deleteMessage(
  messageId: string,
  callback?: (response: any) => void
): void {
  socket?.emit('delete_message', messageId, callback);
}

/**
 * Start typing indicator
 */
export function startTyping(conversationId: string): void {
  emit('typing_start', { conversationId });
}

/**
 * Stop typing indicator
 */
export function stopTyping(conversationId: string): void {
  emit('typing_stop', { conversationId });
}

export default {
  initializeSocket,
  getSocket,
  connectSocket,
  disconnectSocket,
  emit,
  on,
  once,
  off,
  joinConversation,
  leaveConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  startTyping,
  stopTyping,
};
