import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { isAdminOrOwner } from '../middleware';
import { userController } from '../../users/controller';
import { userService } from '../../users/service';

jest.mock('../../users/service', () => ({
  userService: { updateUser: jest.fn() },
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: () => true,
    user: { id: actorId, role: Role.MEMBER },
    params: { id: actorId },
    body: {},
    ...overrides,
  } as unknown as Request;
}

describe('user route owner authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows the authenticated owner of the actual :id route without a body', () => {
    const next = jest.fn();
    const res = response();

    isAdminOrOwner(request({ body: undefined }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('denies another user even when the body claims the authenticated user ID', () => {
    const next = jest.fn();
    const res = response();

    isAdminOrOwner(
      request({ params: { id: otherId }, body: { userId: actorId, name: 'Changed' } }),
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('does not let a second route parameter override the handler target', () => {
    const next = jest.fn();
    const res = response();

    isAdminOrOwner(request({ params: { id: otherId, userId: actorId } }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('ignores a body identity that disagrees with the legitimate route owner', () => {
    const next = jest.fn();

    isAdminOrOwner(request({ body: { userId: otherId } }), response(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows an authenticated admin to reach the target handler', () => {
    const next = jest.fn();

    isAdminOrOwner(
      request({ user: { id: actorId, role: Role.ADMIN }, params: { id: otherId } }),
      response(),
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects an unauthenticated request before considering ownership or admin role', () => {
    const next = jest.fn();
    const res = response();

    isAdminOrOwner(
      request({ isAuthenticated: () => false, user: { id: actorId, role: Role.ADMIN } }),
      res,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it.each([
    { params: {}, body: { userId: actorId } },
    { user: undefined, params: {}, body: {} },
    { user: { id: '', role: Role.MEMBER }, params: { id: '' } },
  ])('denies missing or empty ownership context %#', (overrides) => {
    const next = jest.fn();
    const res = response();

    isAdminOrOwner(request(overrides), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('does not dispatch a forged owner request to the real update handler', async () => {
    const req = request({ params: { id: otherId }, body: { userId: actorId, name: 'Changed' } });
    const res = response();
    const next = jest.fn();
    let handlerResult: Promise<unknown> | undefined;

    isAdminOrOwner(req, res, () => {
      handlerResult = userController.updateUser(req, res, next);
    });
    await handlerResult;

    expect(userService.updateUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('dispatches an allowed owner update using the same route ID', async () => {
    const req = request({ body: { name: 'New name' } });
    const res = response();
    const next = jest.fn();
    let handlerResult: Promise<unknown> | undefined;
    (userService.updateUser as jest.Mock).mockResolvedValue({ id: actorId, name: 'New name' });

    isAdminOrOwner(req, res, () => {
      handlerResult = userController.updateUser(req, res, next);
    });
    await handlerResult;

    expect(userService.updateUser).toHaveBeenCalledWith(actorId, { name: 'New name' });
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
