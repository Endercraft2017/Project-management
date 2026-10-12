/**
 * Tenant Isolation Tests
 *
 * Two organizations, each with an admin, a sprint and a task. Each admin must
 * see and change only their own organization's data through the API, and new
 * rows must be stamped with the creator's organization.
 */

import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import app from '../../server/src/app';
import { DEFAULT_ORGANIZATION_ID } from '../../server/src/tenancy/context';

// Unscoped client for setup and assertions
const db = new PrismaClient();

// Sign requests in as the user named in the x-test-user-id header
jest.mock('../../server/src/middlewares/session', () => ({
  sessionMiddleware: (req: any, res: any, next: any) => {
    req.session = {
      passport: { user: req.headers['x-test-user-id'] || undefined },
      save: (cb: any) => cb && cb(),
      regenerate: (cb: any) => cb && cb(),
      destroy: (cb: any) => cb && cb(),
    };
    next();
  },
  closeSessionStore: jest.fn().mockResolvedValue(undefined),
}));

describe('Tenant isolation', () => {
  const suffix = Date.now();
  let orgB: { id: string };
  let adminA: { id: string };
  let adminB: { id: string };
  let sprintA: { id: string };
  let sprintB: { id: string };
  let taskA: { id: string };
  let taskB: { id: string };

  beforeAll(async () => {
    // Organization A is the original organization from the migration
    orgB = await db.organization.create({
      data: { name: 'Other Co', slug: `other-co-${suffix}` },
    });

    adminA = await db.user.create({
      data: { email: `tenant-a-${suffix}@servicebay.ai`, name: 'Admin A', role: Role.ADMIN },
    });
    adminB = await db.user.create({
      data: { email: `tenant-b-${suffix}@other.example`, name: 'Admin B', role: Role.ADMIN },
    });

    await db.membership.create({
      data: { organizationId: DEFAULT_ORGANIZATION_ID, userId: adminA.id, role: Role.ADMIN },
    });
    await db.membership.create({
      data: { organizationId: orgB.id, userId: adminB.id, role: Role.ADMIN },
    });

    const start = new Date('2030-01-01');
    const end = new Date('2030-01-14');

    sprintA = await db.sprint.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: `Tenant A sprint ${suffix}`,
        startDate: start,
        endDate: end,
        createdById: adminA.id,
      },
    });
    sprintB = await db.sprint.create({
      data: {
        organizationId: orgB.id,
        name: `Tenant B sprint ${suffix}`,
        startDate: start,
        endDate: end,
        createdById: adminB.id,
      },
    });

    taskA = await db.task.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        taskName: `Tenant A task ${suffix}`,
        sprintId: sprintA.id,
        createdById: adminA.id,
      },
    });
    taskB = await db.task.create({
      data: {
        organizationId: orgB.id,
        taskName: `Tenant B task ${suffix}`,
        sprintId: sprintB.id,
        createdById: adminB.id,
      },
    });
  });

  afterAll(async () => {
    // Deleting organization B cascades to its sprints, tasks and memberships
    await db.task.deleteMany({ where: { id: taskA.id } });
    await db.sprint.deleteMany({ where: { createdById: { in: [adminA.id, adminB.id] } } });
    await db.organization.delete({ where: { id: orgB.id } });
    await db.membership.deleteMany({ where: { userId: { in: [adminA.id, adminB.id] } } });
    await db.user.deleteMany({ where: { id: { in: [adminA.id, adminB.id] } } });
    await db.$disconnect();
  });

  const as = (user: { id: string }) => ({ 'x-test-user-id': user.id });

  describe('sprints', () => {
    it('lists only the caller organization sprints', async () => {
      const res = await request(app).get('/api/sprints?limit=100').set(as(adminA));

      expect(res.status).toBe(200);
      const ids = res.body.data.map((s: any) => s.id);
      expect(ids).toContain(sprintA.id);
      expect(ids).not.toContain(sprintB.id);
    });

    it('does not return another organization sprint by id', async () => {
      const res = await request(app).get(`/api/sprints/${sprintB.id}`).set(as(adminA));
      expect(res.status).toBe(404);
    });

    it('cannot update another organization sprint', async () => {
      const res = await request(app)
        .put(`/api/sprints/${sprintB.id}`)
        .set(as(adminA))
        .send({ name: 'Taken over' });

      expect(res.status).toBe(404);
      const unchanged = await db.sprint.findUnique({ where: { id: sprintB.id } });
      expect(unchanged?.name).toBe(`Tenant B sprint ${suffix}`);
    });

    it('cannot delete another organization sprint', async () => {
      const res = await request(app).delete(`/api/sprints/${sprintB.id}`).set(as(adminA));

      expect(res.status).toBe(404);
      expect(await db.sprint.findUnique({ where: { id: sprintB.id } })).not.toBeNull();
    });

    it('stamps new sprints with the creator organization', async () => {
      const res = await request(app)
        .post('/api/sprints')
        .set(as(adminB))
        .send({ name: `Tenant B new sprint ${suffix}`, startDate: '2031-02-01', endDate: '2031-02-14' });

      expect(res.status).toBe(201);
      const created = await db.sprint.findUnique({ where: { id: res.body.data.id } });
      expect(created?.organizationId).toBe(orgB.id);
    });
  });

  describe('tasks', () => {
    it('lists only the caller organization tasks', async () => {
      const res = await request(app).get('/api/tasks?limit=100').set(as(adminB));

      expect(res.status).toBe(200);
      const ids = res.body.data.map((t: any) => t.id);
      expect(ids).toContain(taskB.id);
      expect(ids).not.toContain(taskA.id);
    });

    it('does not return another organization task by id', async () => {
      const res = await request(app).get(`/api/tasks/${taskA.id}`).set(as(adminB));
      expect(res.status).toBe(404);
    });
  });

  describe('users', () => {
    it('lists only members of the caller organization', async () => {
      const res = await request(app).get('/api/users?limit=100').set(as(adminB));

      expect(res.status).toBe(200);
      const ids = res.body.data.users.map((u: any) => u.id);
      expect(ids).toContain(adminB.id);
      expect(ids).not.toContain(adminA.id);
    });

    it('does not return a user from another organization by id', async () => {
      const res = await request(app).get(`/api/users/${adminA.id}`).set(as(adminB));
      expect(res.status).toBe(404);
    });

    it('cannot deactivate a user in another organization', async () => {
      const res = await request(app).delete(`/api/users/${adminA.id}`).set(as(adminB));

      expect(res.status).toBe(404);
      const stillActive = await db.user.findUnique({ where: { id: adminA.id } });
      expect(stillActive?.isActive).toBe(true);
    });
  });

  describe('roles', () => {
    it('takes the role from the membership in the working organization', async () => {
      // Admin B is an admin only in organization B; admin-only routes there work
      const res = await request(app).get('/api/invites').set(as(adminB));
      expect(res.status).toBe(200);
    });
  });
});
