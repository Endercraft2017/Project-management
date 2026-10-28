import { EventEmitter as MockEventEmitter } from 'events';
import { runWithTenant, getTenantContext as mockGetTenantContext } from '@/tenancy/context';
import * as sockets from '../socket-server';
import * as middleware from '../socket-middleware';
const mockSessions = new Map(),
  mockTenants = new Map(),
  mockUsers = new Map(),
  mockTasks = new Map(),
  mockMembers = new Set();
let mockSockets: any[] = [],
  mockOptions: any;
jest.mock('@/config', () => ({
  corsConfig: { origin: 'http://localhost:5173' },
}));
jest.mock('@/middlewares/session', () => ({
  sessionMiddleware: jest.fn(),
  sessionStore: { get: (id: any, cb: any) => cb(null, mockSessions.get(id)) },
}));
jest.mock('@/platform/store', () => ({
  getTenantById: async (id: any) => mockTenants.get(id),
  tenantLifecycleEvents: new MockEventEmitter(),
}));
jest.mock('@/database/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: async ({ where }: any) =>
        mockUsers.get(
          mockGetTenantContext().id + ':' + where.id,
        ),
    },
    task: {
      findUnique: async ({ where }: any) =>
        mockTasks.get(
          mockGetTenantContext().id + ':' + where.id,
        ),
    },
    conversationMember: {
      findUnique: async ({ where }: any) =>
        mockMembers.has(
          mockGetTenantContext().id +
            ':' +
            where.conversationId_userId.conversationId +
            ':' +
            where.conversationId_userId.userId,
        )
          ? { id: 'member' }
          : null,
    },
  },
}));
jest.mock('socket.io', () => ({
  Server: class {
    engine = { use: jest.fn() };
    constructor(_: any, options: any) {
      mockOptions = options;
    }
    in(room: string) {
      return {
        fetchSockets: async () => mockSockets.filter((s) => s.rooms.has(room)),
        disconnectSockets: () =>
          mockSockets
            .filter((s) => s.rooms.has(room))
            .forEach((s) => s.disconnect(true)),
      };
    }
    async fetchSockets() {
      return mockSockets;
    }
    close(cb: any) {
      cb();
    }
  },
}));
const tenantA = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'A0000Z',
  name: 'A',
  schemaName: 'ez_t_aaaaaaaaaaaaaaaa',
  status: 'ACTIVE' as const,
};
const tenantB = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'B0000Z',
  name: 'B',
  schemaName: 'ez_t_bbbbbbbbbbbbbbbb',
  status: 'ACTIVE' as const,
};
function socket(tenant: any, id: string) {
  const sessionId =
    'session-' + tenant.code + (id === 'same-user' ? '' : ':' + id);
  mockSessions.set(sessionId, {
    tenantId: tenant.id,
    passport: { user: id },
    sessionVersion: 0,
    issuedAt: Date.now(),
    workspaceContext: sessionId,
  });
  mockUsers.set(tenant.id + ':' + id, {
    id,
    name: 'Synthetic',
    isActive: true,
    sessionVersion: 0,
    role: 'MEMBER',
  });
  const s: any = {
    id: tenant.code,
    data: { tenantId: tenant.id, userId: id, sessionId },
    request: { sessionID: sessionId },
    handshake: { auth: { workspaceContext: sessionId } },
    rooms: new Set([
      sockets.tenantRoom(tenant.id),
      sockets.userRoom(tenant.id, id),
      sockets.conversationRoom(tenant.id, 'same-conversation'),
    ]),
    emit: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
  };
  return s;
}
beforeAll(() => sockets.initializeSocketServer({} as import('http').Server));
beforeEach(() => {
  mockSessions.clear();
  mockUsers.clear();
  mockMembers.clear();
  mockTasks.clear();
  mockTasks.set(tenantA.id + ':same-task', {
    createdById: 'same-user',
    assignedToId: null,
  });
  mockTasks.set(tenantB.id + ':same-task', {
    createdById: 'same-user',
    assignedToId: null,
  });
  mockTenants.set(tenantA.id, { ...tenantA });
  mockTenants.set(tenantB.id, { ...tenantB });
  mockSockets = [socket(tenantA, 'same-user'), socket(tenantB, 'same-user')];
  mockMembers.add(tenantA.id + ':same-conversation:same-user');
  mockMembers.add(tenantB.id + ':same-conversation:same-user');
});
afterAll(() => sockets.closeSocketServer());
test('colliding users/conversations in separate tenants never receive tenant events', async () => {
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_created', { id: 'same-task' }),
  );
  expect(mockSockets[0].emit).toHaveBeenCalledTimes(1);
  expect(mockSockets[1].emit).not.toHaveBeenCalled();
});
test('fresh session deletion blocks delivery to an already connected socket', async () => {
  mockSessions.delete('session-A0000Z');
  await runWithTenant(tenantA, () =>
    sockets.emitUserEvent(
      'same-user',
      'new_message',
      { conversationId: 'same-conversation' },
      { conversationId: 'same-conversation' },
    ),
  );
  expect(mockSockets[0].emit).not.toHaveBeenCalled();
  expect(mockSockets[0].disconnect).toHaveBeenCalledWith(true);
});
test('fresh membership removal blocks an already joined conversation', async () => {
  mockMembers.delete(tenantA.id + ':same-conversation:same-user');
  await runWithTenant(tenantA, () =>
    sockets.emitConversationEvent('same-conversation', 'new_message', {
      content: 'private',
    }),
  );
  expect(mockSockets[0].emit).not.toHaveBeenCalled();
  expect(mockSockets[0].leave).toHaveBeenCalledWith(
    sockets.conversationRoom(tenantA.id, 'same-conversation'),
  );
  expect(mockSockets[1].emit).not.toHaveBeenCalled();
});
test('tenant suspension and user deactivation are rechecked before delivery', async () => {
  mockTenants.set(tenantA.id, { ...tenantA, status: 'SUSPENDED' });
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_created', { id: 'same-task' }),
  );
  expect(mockSockets[0].emit).not.toHaveBeenCalled();
  mockTenants.set(tenantA.id, { ...tenantA });
  mockUsers.get(tenantA.id + ':same-user').isActive = false;
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_created', { id: 'same-task' }),
  );
  expect(mockSockets[0].emit).not.toHaveBeenCalled();
});
test('session version mismatch rejects a connected identity', async () => {
  mockUsers.get(tenantA.id + ':same-user').sessionVersion = 1;
  await expect(middleware.readSocketIdentity(mockSockets[0])).rejects.toThrow(
    'Unauthorized',
  );
});
test('callback enters the actual identity ALS and fails closed after logout', async () => {
  const auth = Object.assign(mockSockets[0], { connected: true });
  await middleware.withSocketAuthorization(auth, async () => {
    expect(mockGetTenantContext().id).toBe(tenantA.id);
  });
  mockSessions.delete('session-A0000Z');
  await expect(
    middleware.withSocketAuthorization(auth, async () => {
      throw new Error('must not execute');
    }),
  ).rejects.toThrow('Unauthorized');
  expect(auth.disconnect).toHaveBeenCalled();
});
test('events strip nested credential fields but retain dates and ordinary data', async () => {
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_created', {
      id: 'same-task',
      date: new Date('2026-01-01'),
      sender: {
        name: 'Safe',
        passwordHash: 'do-not-send',
        googleRefreshToken: 'do-not-send',
        sessionVersion: 0,
      },
    }),
  );
  expect(mockSockets[0].emit).toHaveBeenCalledWith('task_created', {
    id: 'same-task',
    date: '2026-01-01T00:00:00.000Z',
    sender: { name: 'Safe' },
  });
});
test('legacy facade requires ALS and rejects global private emits', () => {
  expect(() => sockets.getSocketServer()).toThrow('Tenant context');
  runWithTenant(tenantA, () =>
    expect(() =>
      sockets.getSocketServer().emit('new_message', { content: 'private' }),
    ).toThrow('Private events'),
  );
});
test('session revocation disconnects only the targeted session', async () => {
  await sockets.disconnectSessionSockets('session-A0000Z');
  expect(mockSockets[0].disconnect).toHaveBeenCalledWith(true);
  expect(mockSockets[1].disconnect).not.toHaveBeenCalled();
});
test('websocket Origin has the same UI boundary as HTTP', () => {
  const cb = jest.fn();
  mockOptions.allowRequest(
    { headers: { origin: 'https://other.invalid' } },
    cb,
  );
  expect(cb).toHaveBeenCalledWith(null, false);
});

test('tenant membership alone does not authorize private task payloads', async () => {
  const outsider = socket(tenantA, 'unrelated-user');
  mockSockets.push(outsider);
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_created', {
      id: 'same-task',
      taskName: 'Private task',
    }),
  );
  expect(mockSockets[0].emit).toHaveBeenCalledTimes(1);
  expect(outsider.emit).not.toHaveBeenCalled();
});
test('deleted task uses the trusted pre-delete ACL and current user roles', async () => {
  mockTasks.clear();
  const outsider = socket(tenantA, 'unrelated-user');
  mockSockets.push(outsider);
  await runWithTenant(tenantA, () =>
    sockets.emitTenantEvent('task_deleted', 'removed-task', {
      taskAcl: { createdById: 'same-user', assignedToId: null },
    }),
  );
  expect(mockSockets[0].emit).toHaveBeenCalledWith(
    'task_deleted',
    'removed-task',
  );
  expect(outsider.emit).not.toHaveBeenCalled();
});

export {};
