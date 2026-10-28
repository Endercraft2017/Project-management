/** Raw transport stays internal; legacy emit callers receive a tenant-scoped facade. */
import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { sessionMiddleware } from '@/middlewares/session';
import { corsConfig } from '@/config';
import { getTenantContext, runWithTenant } from '@/tenancy/context';
import { readSocketIdentity, publicSocketPayload } from './socket-middleware';
import prisma from '@/database/client';
import { tenantLifecycleEvents } from '@/platform/store';

let io: SocketServer | null = null;
tenantLifecycleEvents.on('changed', ({ tenantId, status }) => {
  if (status !== 'ACTIVE')
    void disconnectTenantSockets(tenantId).catch(() =>
      console.error('[Realtime] Revocation unavailable'),
    );
});
export const tenantRoom = (tenantId: string) => `tenant:${tenantId}`;
export const userRoom = (tenantId: string, userId: string) =>
  `${tenantRoom(tenantId)}:user:${userId}`;
export const conversationRoom = (tenantId: string, conversationId: string) =>
  `${tenantRoom(tenantId)}:conversation:${conversationId}`;

export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  if (io) return io;
  io = new SocketServer(httpServer, {
    cors: {
      origin: corsConfig.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    allowRequest: (req, callback) => {
      // Browsers must use the configured UI origin, including websocket upgrades.
      callback(
        null,
        !req.headers.origin || req.headers.origin === corsConfig.origin,
      );
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  io.engine.use(sessionMiddleware);
  return io;
}

const tenantEvents = new Set([
  'task_created',
  'task_updated',
  'task_deleted',
  'daily_update_changed',
  'user_status_changed',
]);

type Target = {
  userId?: string;
  conversationId?: string;
  excludeSocketId?: string;
  taskAcl?: { createdById: string; assignedToId: string | null };
};
/** Fresh session, tenant, user and resource checks immediately before each delivery.
 * Room membership is a routing hint, never an authorization decision.
 */
export async function emitTenantEvent(
  event: string,
  payload: unknown,
  target: Target = {},
): Promise<void> {
  const tenant = getTenantContext();
  if (!target.userId && !target.conversationId && !tenantEvents.has(event))
    throw new Error('Private events require a recipient');
  if (!io) return;
  const room = target.userId
    ? userRoom(tenant.id, target.userId)
    : target.conversationId
      ? conversationRoom(tenant.id, target.conversationId)
      : tenantRoom(tenant.id);
  const sockets = await io.in(room).fetchSockets();
  await Promise.all(
    sockets.map(async (socket) => {
      if (
        socket.id === target.excludeSocketId ||
        socket.data.tenantId !== tenant.id
      )
        return;
      try {
        const identity = await readSocketIdentity(socket);
        if (identity.tenant.id !== tenant.id) {
          socket.disconnect(true);
          return;
        }
        if (target.userId && identity.user.id !== target.userId) return;
        if (event.startsWith('task_')) {
          const value = payload as { id?: string; task?: { id?: string } };
          const taskId =
            typeof payload === 'string'
              ? payload
              : value?.task?.id || value?.id;
          const acl =
            target.taskAcl ||
            (taskId
              ? await runWithTenant(identity.tenant, () =>
                  prisma.task.findUnique({
                    where: { id: taskId },
                    select: { createdById: true, assignedToId: true },
                  }),
                )
              : null);
          if (
            !acl ||
            (identity.user.role !== 'ADMIN' &&
              acl.createdById !== identity.user.id &&
              acl.assignedToId !== identity.user.id)
          )
            return;
        }
        if (target.conversationId) {
          const member = await runWithTenant(identity.tenant, () =>
            prisma.conversationMember.findUnique({
              where: {
                conversationId_userId: {
                  conversationId: target.conversationId!,
                  userId: identity.user.id,
                },
              },
              select: { id: true },
            }),
          );
          if (!member) {
            socket.leave(conversationRoom(tenant.id, target.conversationId));
            return;
          }
        }
        socket.emit(event, publicSocketPayload(payload));
      } catch {
        socket.disconnect(true);
      }
    }),
  );
}
export const emitUserEvent = (
  userId: string,
  event: string,
  payload: unknown,
  extra: Target = {},
) => emitTenantEvent(event, payload, { ...extra, userId });
export const emitConversationEvent = (
  conversationId: string,
  event: string,
  payload: unknown,
  excludeSocketId?: string,
) => emitTenantEvent(event, payload, { conversationId, excludeSocketId });

/** Existing HTTP callers use io.emit/io.to().emit; never expose raw global emits.
 * Async delivery failures are contained; persistence success is independent of
 * best-effort realtime delivery. Explicit async helpers can be awaited by callers.
 */
export function getSocketServer(): SocketServer {
  getTenantContext(); // Fail closed, even when transport has not started.
  const schedule = (event: string, payload: unknown, target: Target) => {
    const conversationId =
      typeof (payload as any)?.conversationId === 'string'
        ? (payload as any).conversationId
        : undefined;
    if (target.userId && conversationId) target = { ...target, conversationId };
    if (
      !target.userId &&
      !target.conversationId &&
      ![
        'task_created',
        'task_updated',
        'task_deleted',
        'daily_update_changed',
        'user_status_changed',
      ].includes(event)
    )
      throw new Error('Private events require a recipient');
    void emitTenantEvent(event, payload, target).catch(() =>
      console.error('[Realtime] Delivery unavailable'),
    );
    return true;
  };
  const facade: any = {
    emit: (event: string, payload: unknown) => schedule(event, payload, {}),
    to: (room: string) => {
      if (typeof room !== 'string')
        throw new Error('Invalid realtime recipient');
      if (room.startsWith('user:'))
        return {
          emit: (event: string, payload: unknown) =>
            schedule(event, payload, { userId: room.slice(5) }),
        };
      if (room.startsWith('conversation:'))
        return {
          emit: (event: string, payload: unknown) =>
            schedule(event, payload, { conversationId: room.slice(13) }),
        };
      throw new Error('Explicit tenant-local realtime recipient required');
    },
  };
  return facade as SocketServer;
}

export async function disconnectSessionSockets(
  sessionId: string,
): Promise<void> {
  if (!io) return;
  for (const socket of await io.fetchSockets())
    if (socket.data.sessionId === sessionId) socket.disconnect(true);
}
export async function disconnectUserSockets(
  tenantId: string,
  userId: string,
): Promise<void> {
  if (io) io.in(userRoom(tenantId, userId)).disconnectSockets(true);
}
export async function disconnectTenantSockets(tenantId: string): Promise<void> {
  if (io) io.in(tenantRoom(tenantId)).disconnectSockets(true);
}
export async function closeSocketServer(): Promise<void> {
  if (io) {
    const server = io;
    io = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
