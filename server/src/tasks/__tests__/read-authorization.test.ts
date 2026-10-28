import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { taskController } from '../controller';
import { taskService } from '../service';

jest.mock('../service', () => ({
  taskService: { getTaskById: jest.fn() },
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: actorId, role: Role.MEMBER },
    params: { id: taskId },
    query: {},
    ...overrides,
  } as unknown as Request;
}

describe('task read authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (taskService.getTaskById as jest.Mock).mockResolvedValue({
      id: taskId,
      createdById: otherId,
      assignedToId: otherId,
      taskName: 'Private task',
    });
  });

  it.each([{}, { viewMode: 'mention' }, { viewMode: 'mention', includeSubtasks: 'true' }])(
    'denies unrelated members regardless of client-selected presentation mode %j',
    async (query) => {
      const res = response();
      const next = jest.fn();

      await taskController.getTaskById(request({ query }), res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.anything() }));
      expect(next).not.toHaveBeenCalled();
    }
  );

  it.each([
    { description: 'creator', role: Role.MEMBER, createdById: actorId, assignedToId: otherId },
    { description: 'assignee', role: Role.MEMBER, createdById: otherId, assignedToId: actorId },
    { description: 'admin', role: Role.ADMIN, createdById: otherId, assignedToId: otherId },
  ])('allows a legitimate $description without weakening the normal policy', async (access) => {
    const task = { id: taskId, createdById: access.createdById, assignedToId: access.assignedToId };
    (taskService.getTaskById as jest.Mock).mockResolvedValue(task);
    const res = response();
    const next = jest.fn();

    await taskController.getTaskById(
      request({ user: { id: actorId, role: access.role }, query: { viewMode: 'mention' } }),
      res,
      next
    );

    expect(taskService.getTaskById).toHaveBeenCalledWith(taskId, false, false);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: task });
    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found for an absent task', async () => {
    (taskService.getTaskById as jest.Mock).mockResolvedValue(null);
    const res = response();

    await taskController.getTaskById(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('validates the route ID before loading a task', async () => {
    const res = response();

    await taskController.getTaskById(request({ params: { id: 'invalid' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(taskService.getTaskById).not.toHaveBeenCalled();
  });

  it('passes dependency failures to the normal error handler', async () => {
    const error = new Error('Storage unavailable');
    (taskService.getTaskById as jest.Mock).mockRejectedValue(error);
    const res = response();
    const next = jest.fn();

    await taskController.getTaskById(request(), res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
