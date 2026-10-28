import type { Request, Response } from 'express';
import * as controller from '../controller';
import * as service from '../service';

jest.mock('../service', () => ({ createInvite: jest.fn(), listInvites: jest.fn(), revokeInvite: jest.fn() }));

function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}
const actorId = '11111111-1111-4111-8111-111111111111';
const inviteId = '22222222-2222-4222-8222-222222222222';
const request = (body = {}) => ({ body, user: { id: actorId }, query: {}, params: {} } as unknown as Request);

describe('tenant invitation controller', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a customer email domain and returns an honest copy-once activation link', async () => {
    const invite = { id: inviteId, email: 'person@customer.example', role: 'MEMBER', status: 'PENDING', setupUrl: '/activate?tenantCode=A0000Z&token=one-use-capability' };
    (service.createInvite as jest.Mock).mockResolvedValue(invite);
    const res = response();
    const next = jest.fn();
    await controller.sendInvite(request({ email: ' Person@Customer.Example ', role: 'MEMBER' }), res, next);
    expect(service.createInvite).toHaveBeenCalledWith('person@customer.example', 'MEMBER', actorId, undefined);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: invite, setupUrl: invite.setupUrl, message: expect.stringContaining('no email was sent') }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied tenancy fields', async () => {
    const res = response();
    await controller.sendInvite(request({ email: 'person@customer.example', tenantId: 'another-tenant' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.createInvite).not.toHaveBeenCalled();
  });

  it('preserves the existing admin list envelope without issuing another setup link', async () => {
    const invites = [{ id: inviteId, email: 'person@customer.example', status: 'PENDING' }];
    (service.listInvites as jest.Mock).mockResolvedValue(invites);
    const res = response();
    await controller.listInvites(request(), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ success: true, data: invites, count: 1 });
  });

  it('revokes the validated invitation for the authenticated actor', async () => {
    const req = request(); req.params.id = inviteId;
    const res = response();
    await controller.revokeInvite(req, res, jest.fn());
    expect(service.revokeInvite).toHaveBeenCalledWith(inviteId, actorId);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('retires public credentialless acceptance and recoverable resend', () => {
    for (const handler of [controller.acceptInvite, controller.validateInvite, controller.resendInvite]) {
      const res = response();
      handler(request({ token: 'legacy-token' }), res);
      expect(res.status).toHaveBeenCalledWith(410);
    }
    expect(service.createInvite).not.toHaveBeenCalled();
  });
});
