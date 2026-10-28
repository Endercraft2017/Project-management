import type { Request, Response } from 'express';
import { createSprintSchema } from '../../sprints/validators';
import { createNoteSchema, updateNoteSchema } from '../../notes/validators';
import { getMessagesQuerySchema, sendMessageBodySchema } from '../../chat/validators';
import { listTasksQuerySchema } from '../../tasks/validators';
import projects from '../../projects/routes';
import prisma from '@/database/client';

jest.mock('@/chat/socket-server', () => ({ getSocketServer: jest.fn() }));

jest.mock('@/database/client', () => ({
  __esModule: true,
  default: { project: { findUnique: jest.fn(), updateMany: jest.fn() } },
}));

describe('Zod 4 request compatibility', () => {
  it('coerces sprint dates and retains validation paths and custom messages', () => {
    const data = { name: 'Sprint', startDate: '2026-10-28', endDate: '2026-11-01' };
    const parsed = createSprintSchema.parse(data);
    expect(parsed.startDate).toBeInstanceOf(Date);
    const invalid = createSprintSchema.safeParse({ ...data, startDate: 'invalid' });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0]).toEqual(expect.objectContaining({ path: ['startDate'], message: 'Invalid start date format' }));
    expect(createSprintSchema.safeParse({ ...data, endDate: '2026-10-20' }).success).toBe(false);
    expect(createSprintSchema.safeParse({ name: 'Missing dates' }).success).toBe(false);
  });

  it('keeps typed query defaults and note creation defaults', () => {
    expect(getMessagesQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(listTasksQuerySchema.parse({ page: '2' })).toEqual(expect.objectContaining({ page: 2, limit: 20, includeSubtasks: false }));
    expect(createNoteSchema.parse({ title: 'Note', content: '' })).toEqual({ title: 'Note', content: '', tags: [], isPinned: false });
    expect(updateNoteSchema.parse({ title: 'Renamed' })).toEqual({ title: 'Renamed' });
  });

  it('continues to reject an empty chat message after applying its content default', () => {
    const empty = sendMessageBodySchema.safeParse({});
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.issues[0].path).toEqual(['content']);
    expect(sendMessageBodySchema.parse({ content: ' Hello ' })).toEqual({ content: 'Hello' });
  });

  it('does not clear an existing project description during a name-only patch', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const expectedUpdatedAt = '2026-10-28T00:00:00.000Z';
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({ id, name: 'Original', description: 'Keep this description', createdById: 'actor' });
    (prisma.project.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const handler = projects.stack.find((layer) => layer.route?.path === '/:id' && layer.route.stack.some((entry: { method?: string }) => entry.method === 'patch'))!.route.stack[0].handle;
    const req = { params: { id }, body: { name: 'Renamed', expectedUpdatedAt }, user: { id: 'actor', role: 'ADMIN' } } as unknown as Request;
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();
    await handler(req, res as unknown as Response, next);
    expect(prisma.project.updateMany).toHaveBeenCalledWith({ where: { id, updatedAt: new Date(expectedUpdatedAt) }, data: { name: 'Renamed' } });
    expect(next).not.toHaveBeenCalled();
  });
});
