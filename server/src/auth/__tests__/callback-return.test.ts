import type { Request, Response } from 'express';
import authRoutes from '../routes';

jest.mock('@/config', () => ({
  corsConfig: { clientUrl: 'https://client.example', origin: 'https://client.example' },
  sessionConfig: { maxAge: 43200000 },
}));
jest.mock('@/platform/store', () => ({ getTenantByCode: jest.fn(), activateOwner: jest.fn() }));
jest.mock('@/database/client', () => ({ prisma: {} }));

// Invoke the actual registered handlers without starting any server or provider.
describe('disabled external login capability', () => {
  it('reports password login and honest disabled integration capabilities', () => {
    const route = authRoutes.stack.find((layer) => layer.route?.path === '/capabilities')!.route;
    const json = jest.fn();
    route.stack[0].handle({} as Request, { json } as unknown as Response, jest.fn());
    expect(json).toHaveBeenCalledWith({ success: true, passwordEnabled: true, googleEnabled: false, driveEnabled: false, aiEnabled: false });
  });

  it.each(['/google', '/drive'])('fails %s closed without following query return hints', (path) => {
    const layer = authRoutes.stack.find((candidate) => !candidate.route && candidate.regexp.test(path))!;
    const json = jest.fn();
    const res = { status: jest.fn(), json };
    res.status.mockReturnValue(res);
    layer.handle({ query: { returnTo: 'https://untrusted.example' } } as unknown as Request, res as unknown as Response, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'CAPABILITY_DISABLED' }));
  });
});
