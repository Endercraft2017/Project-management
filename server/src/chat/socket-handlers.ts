/** Every incoming realtime callback re-enters the authenticated tenant scope. */
import { Server as SocketServer, Socket } from 'socket.io';
import { getTenantContext, runWithTenant } from '@/tenancy/context';
import {
  AuthenticatedSocket,
  withSocketAuthorization,
  publicSocketPayload,
  messageRateLimiter,
  typingRateLimiter,
} from './socket-middleware';
import {
  tenantRoom,
  userRoom,
  conversationRoom,
  emitTenantEvent,
  emitConversationEvent,
  emitUserEvent,
} from './socket-server';
import prisma from '@/database/client';
import * as conversations from './conversation-service';
import * as messages from './message-service';
import * as threads from './thread-service';
import * as schemas from './validators';
const online = new Map<string, Set<string>>();
const identityKey = (tenantId: string, userId: string) =>
  `${tenantId}:${userId}`;
const deliver = (p: Promise<void>) =>
  p.catch(() => {
    console.error('[Realtime] Delivery unavailable');
  });
async function requireMember(conversationId: string, userId: string) {
  if (!(await conversations.isMemberOfConversation(conversationId, userId)))
    throw new Error('Forbidden');
}
async function notify(
  conversationId: string,
  message: any,
  senderId: string,
  senderName: string,
  isThread: boolean,
  parentMessageId?: string,
) {
  const members = await conversations.getConversationMembers(conversationId);
  const ids = new Set(members.map((m) => m.id));
  await Promise.all(
    members
      .filter((m) => m.id !== senderId)
      .map((m) =>
        deliver(
          emitUserEvent(m.id, 'new_message', message, { conversationId }),
        ),
      ),
  );
  await Promise.all(
    (message.mentions || [])
      .filter((id: string) => id !== senderId && ids.has(id))
      .map((id: string) =>
        deliver(
          emitUserEvent(
            id,
            'mention_notification',
            {
              messageId: message.id,
              conversationId,
              senderId,
              senderName,
              content: message.content,
              isThread,
              ...(parentMessageId ? { parentMessageId } : {}),
            },
            { conversationId },
          ),
        ),
      ),
  );
}
export function registerSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    const auth = socket as AuthenticatedSocket;
    if (!auth.tenant || !auth.userId) {
      socket.disconnect(true);
      return;
    }
    const tenant = auth.tenant,
      userId = auth.userId,
      key = identityKey(tenant.id, userId);
    socket.join(tenantRoom(tenant.id));
    socket.join(userRoom(tenant.id, userId));
    if (!online.has(key)) online.set(key, new Set());
    online.get(key)!.add(socket.id);
    void runWithTenant(tenant, () =>
      deliver(
        emitTenantEvent(
          'user_status_changed',
          { userId, userName: auth.userName, status: 'online' },
          { excludeSocketId: socket.id },
        ),
      ),
    );
    const bind = (
      event: string,
      schema: any,
      operation: (data: any) => Promise<any>,
    ) => {
      socket.on(event, (data: unknown, callback: unknown) => {
        const ack =
          typeof callback === 'function'
            ? (callback as (value: any) => void)
            : () => {};
        void withSocketAuthorization(auth, async () => {
          const parsed = schema.parse(data),
            result = await operation(parsed);
          await withSocketAuthorization(auth, async () => {
            let conversationId =
              parsed.conversationId || result?.conversationId;
            if (!conversationId && parsed.parentMessageId)
              conversationId = (
                await prisma.message.findUnique({
                  where: { id: parsed.parentMessageId },
                  select: { conversationId: true },
                })
              )?.conversationId;
            if (conversationId)
              await requireMember(conversationId, auth.userId);
            ack({
              success: true,
              ...(result === undefined
                ? {}
                : { data: publicSocketPayload(result) }),
            });
          });
        }).catch(() =>
          ack({ success: false, error: 'Request denied or unavailable' }),
        );
      });
    };
    bind(
      'join_conversation',
      schemas.joinConversationSchema,
      async ({ conversationId }) => {
        await requireMember(conversationId, userId);
        await socket.join(conversationRoom(tenant.id, conversationId));
        await conversations.updateLastReadAt(conversationId, userId);
        await deliver(
          emitConversationEvent(
            conversationId,
            'user_joined',
            { userId, userName: auth.userName, conversationId },
            socket.id,
          ),
        );
        return { conversationId };
      },
    );
    bind(
      'leave_conversation',
      schemas.leaveConversationSchema,
      async ({ conversationId }) => {
        await requireMember(conversationId, userId);
        await socket.leave(conversationRoom(tenant.id, conversationId));
        await conversations.updateLastReadAt(conversationId, userId);
        await deliver(
          emitConversationEvent(
            conversationId,
            'user_left',
            { userId, userName: auth.userName, conversationId },
            socket.id,
          ),
        );
        return { conversationId };
      },
    );
    bind(
      'send_message',
      schemas.sendMessageSchema,
      async ({ conversationId, content, driveFileIds }) => {
        if (!messageRateLimiter.check(key)) throw new Error('Rate limit');
        if (driveFileIds?.length) throw new Error('Integration unavailable');
        const message = await messages.sendMessage(
          conversationId,
          userId,
          content,
        );
        await deliver(
          emitConversationEvent(conversationId, 'new_message', message),
        );
        await notify(conversationId, message, userId, auth.userName, false);
        return message;
      },
    );
    bind(
      'edit_message',
      schemas.editMessageSchema,
      async ({ messageId, content }) => {
        const result = await messages.editMessage(messageId, userId, content);
        await deliver(
          emitConversationEvent(
            result.conversationId,
            'message_edited',
            result,
          ),
        );
        return result;
      },
    );
    bind(
      'delete_message',
      schemas.deleteMessageSchema,
      async ({ messageId }) => {
        const result = await messages.deleteMessage(messageId, userId);
        await deliver(
          emitConversationEvent(result.conversationId, 'message_deleted', {
            id: result.id,
            conversationId: result.conversationId,
            isDeleted: result.isDeleted,
          }),
        );
        return result;
      },
    );
    for (const [event, notification] of [
      ['typing_start', 'user_typing'],
      ['typing_stop', 'user_stopped_typing'],
    ]) {
      bind(event, schemas.typingEventSchema, async ({ conversationId }) => {
        if (!typingRateLimiter.check(key)) throw new Error('Rate limit');
        await requireMember(conversationId, userId);
        await deliver(
          emitConversationEvent(
            conversationId,
            notification,
            { userId, userName: auth.userName, conversationId },
            socket.id,
          ),
        );
      });
    }
    for (const [event, notification, operation] of [
      ['add_reaction', 'reaction_added', messages.addReaction],
      ['remove_reaction', 'reaction_removed', messages.removeReaction],
    ] as const) {
      bind(event, schemas.reactionSchema, async ({ messageId, emoji }) => {
        if (!messageRateLimiter.check(key)) throw new Error('Rate limit');
        const result = await operation(messageId, userId, emoji);
        await deliver(
          emitConversationEvent(result.conversationId, notification, {
            messageId: result.id,
            reactions: result.reactions,
            userId,
            emoji,
          }),
        );
        return result;
      });
    }
    bind(
      'send_thread_reply',
      schemas.sendThreadReplySchema,
      async ({ parentMessageId, content }) => {
        if (!messageRateLimiter.check(key)) throw new Error('Rate limit');
        const reply = await threads.sendThreadReply(
          parentMessageId,
          userId,
          content,
        );
        await deliver(
          emitConversationEvent(reply.conversationId, 'thread_reply_added', {
            reply,
            parentMessageId,
          }),
        );
        await notify(
          reply.conversationId,
          reply,
          userId,
          auth.userName,
          true,
          parentMessageId,
        );
        return reply;
      },
    );
    bind(
      'get_thread_replies',
      schemas.getThreadRepliesSchema,
      async ({ parentMessageId, cursor, limit }) =>
        threads.getThreadReplies(parentMessageId, userId, limit, cursor),
    );
    socket.on('disconnect', () => {
      const set = online.get(key);
      set?.delete(socket.id);
      if (set?.size === 0) {
        online.delete(key);
        void runWithTenant(tenant, () =>
          deliver(
            emitTenantEvent(
              'user_status_changed',
              { userId, userName: auth.userName, status: 'offline' },
              { excludeSocketId: socket.id },
            ),
          ),
        );
      }
    });
    socket.on('error', () =>
      console.error('[Realtime] Connection unavailable'),
    );
  });
}
export function isUserOnline(userId: string): boolean {
  return (
    (online.get(identityKey(getTenantContext().id, userId))?.size || 0) > 0
  );
}
export function getOnlineUsers(): string[] {
  const prefix = `${getTenantContext().id}:`;
  return [...online.keys()]
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
}
export function getUserSocketCount(userId: string): number {
  return online.get(identityKey(getTenantContext().id, userId))?.size || 0;
}
