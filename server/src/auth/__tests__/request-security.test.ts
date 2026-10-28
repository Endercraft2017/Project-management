import type { Request, Response } from 'express';
import { requireTrustedOrigin } from '../request-security';

jest.mock('@/config', () => ({ corsConfig: { clientUrl: 'https://app.example.test', origin: 'https://app.example.test' } }));

describe('cookie write origin boundary', () => {
  it.each([undefined, 'null', 'https://sibling.example.test', 'https://app.example.test.untrusted.test'])('rejects an untrusted or absent write Origin %s', (origin) => {
    const req = { method: 'POST', get: () => origin } as unknown as Request;
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();
    requireTrustedOrigin(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows writes only from the configured origin', () => {
    const next = jest.fn();
    requireTrustedOrigin({ method: 'POST', get: () => 'https://app.example.test' } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows safe reads without requiring an Origin header', () => {
    const next = jest.fn();
    requireTrustedOrigin({ method: 'GET', get: () => undefined } as unknown as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
