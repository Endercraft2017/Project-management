import type { Request, Response } from 'express';
import authRoutes from '../routes';
import express from 'express';
import request from 'supertest';

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


describe('legacy Google browser navigation', () => {
  const app = express();
  app.use('/api/auth', authRoutes);

  it.each(['/api/auth/google', '/api/auth/google/callback'])('redirects %s HTML navigation to native login and discards old query data', async (path) => {
    const response = await request(app).get(`${path}?code=synthetic-code&state=synthetic-state&returnTo=https://untrusted.example`).set('Accept', 'text/html');
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/login?error=google_disabled');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each(['application/json', '*/*'])('keeps the disabled-capability JSON contract for Accept %s', async (accept) => {
    const response = await request(app).get('/api/auth/google').set('Accept', accept);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('CAPABILITY_DISABLED');
    expect(response.headers.location).toBeUndefined();
  });
});
