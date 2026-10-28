/** Session and tenant authorization for every realtime boundary. */
import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import prisma from '@/database/client';
import { sessionStore } from '@/middlewares/session';
import { getTenantById } from '@/platform/store';
import { runWithTenant, TenantContext } from '@/tenancy/context';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  tenant: TenantContext;
}

const credentialKeys = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'googlerefreshtoken',
  'googleaccesstoken',
  'tokenexpiresat',
  'sessionversion',
  'setuptoken',
  'setuptokenhash',
  'setup_token_hash',
  'access_token',
  'refresh_token',
]);
/** Explicit transport DTO barrier for legacy services that include whole users. */
export function publicSocketPayload<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(
    JSON.stringify(value, (key, data) =>
      credentialKeys.has(key.toLowerCase()) ? undefined : data,
    ),
  );
}

export async function readSocketIdentity(
  socket: any,
): Promise<{ tenant: TenantContext; user: { id: string; name: string; role: string } }> {
  const sessionId = socket.data?.sessionId || socket.request?.sessionID;
  if (typeof sessionId !== 'string' || !sessionId)
    throw new Error('Unauthorized');
  const session: any = await new Promise((resolve, reject) => {
    sessionStore.get(sessionId, (error: any, value: any) =>
      error ? reject(error) : resolve(value),
    );
  });
  const userId = session?.passport?.user;
  if (
    !session ||
    typeof session.tenantId !== 'string' ||
    typeof userId !== 'string' ||
    !Number.isInteger(session.sessionVersion) ||
    !Number.isFinite(session.issuedAt)
  ) {
    throw new Error('Unauthorized');
  }
  if (
    session.cookie?.expires &&
    new Date(session.cookie.expires).getTime() <= Date.now()
  )
    throw new Error('Unauthorized');
  if (
    socket.data?.tenantId &&
    (session.tenantId !== socket.data.tenantId || userId !== socket.data.userId)
  )
    throw new Error('Unauthorized');
  const tenant = await getTenantById(session.tenantId);
  if (!tenant || tenant.status !== 'ACTIVE') throw new Error('Unauthorized');
  const user = await runWithTenant(tenant, () =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true, sessionVersion: true, role: true },
    }),
  );
  if (!user?.isActive || user.sessionVersion !== session.sessionVersion)
    throw new Error('Unauthorized');
  return { tenant, user };
}

export async function authenticateSocket(
  socket: Socket,
  next: (err?: ExtendedError) => void,
) {
  try {
    const sessionId = (socket.request as any).sessionID;
    const session: any = await new Promise((resolve, reject) => sessionStore.get(sessionId, (error: any, value: any) => error ? reject(error) : resolve(value)));
    if (!session?.workspaceContext || socket.handshake?.auth?.workspaceContext !== session.workspaceContext) throw new Error('Unauthorized');
    const { tenant, user } = await readSocketIdentity(socket);
    const authenticated = socket as AuthenticatedSocket;
    authenticated.tenant = tenant;
    authenticated.userId = user.id;
    authenticated.userName = user.name;
    // Server-derived identifiers only. No client handshake tenant/schema selectors.
    socket.data.tenantId = tenant.id;
    socket.data.userId = user.id;
    socket.data.sessionId = (socket.request as any).sessionID;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}

/** Explicit ALS scope on each callback, independent of handshake execution context. */
export async function withSocketAuthorization<T>(
  socket: AuthenticatedSocket,
  fn: () => Promise<T>,
): Promise<T> {
  let identity: Awaited<ReturnType<typeof readSocketIdentity>>;
  try {
    identity = await readSocketIdentity(socket);
  } catch (error) {
    socket.disconnect(true);
    throw error;
  }
  socket.tenant = identity.tenant;
  socket.userId = identity.user.id;
  socket.userName = identity.user.name;
  return runWithTenant(identity.tenant, fn);
}

export class SocketRateLimiter {
  private events = new Map<string, number[]>();
  constructor(
    private maxEvents = 30,
    private windowMs = 60000,
  ) {}
  check(key: string): boolean {
    const now = Date.now();
    const recent = (this.events.get(key) || []).filter(
      (time) => now - time < this.windowMs,
    );
    if (recent.length >= this.maxEvents) return false;
    recent.push(now);
    this.events.set(key, recent);
    return true;
  }
  clear(key: string) {
    this.events.delete(key);
  }
  cleanup() {
    const now = Date.now();
    for (const [key, times] of this.events) {
      const recent = times.filter((time) => now - time < this.windowMs);
      if (recent.length) this.events.set(key, recent);
      else this.events.delete(key);
    }
  }
}
export const messageRateLimiter = new SocketRateLimiter(30, 60000);
export const typingRateLimiter = new SocketRateLimiter(60, 60000);
const cleanup = setInterval(() => {
  messageRateLimiter.cleanup();
  typingRateLimiter.cleanup();
}, 300000);
cleanup.unref();
