import type { Request, Response } from 'express';
import passport from '../passport-config';
import authRoutes from '../routes';

jest.mock('../passport-config', () => ({
  __esModule: true,
  default: { authenticate: jest.fn(() => jest.fn()) },
}));

jest.mock('@/config', () => ({
  corsConfig: { clientUrl: 'https://client.example' },
}));

// Exercise the handler registered on the real Express callback route without
// opening a server or loading Google/database configuration.
const callbackRoute = authRoutes.stack.find((layer) => layer.route?.path === '/google/callback')!.route;
const completeLogin = callbackRoute.stack[callbackRoute.stack.length - 1].handle;

function callbackRequest(query: Record<string, string> = {}) {
  let finishSave: (error?: Error) => void;
  const save = jest.fn((done: (error?: Error) => void) => {
    finishSave = done;
  });
  return {
    req: { session: { save }, user: { email: 'member@example.test' }, query } as unknown as Request,
    save,
    finishSave: (error?: Error) => finishSave(error),
  };
}

describe('Google callback return route', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('waits for the session save before returning to the app entry', () => {
    const { req, save, finishSave } = callbackRequest();
    const redirect = jest.fn();

    completeLogin(req, { redirect } as unknown as Response, jest.fn());

    expect(save).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    finishSave();
    expect(redirect).toHaveBeenCalledWith('https://client.example/app');
  });

  it('preserves the configured session-failure redirect', () => {
    const { req, finishSave } = callbackRequest();
    const redirect = jest.fn();

    completeLogin(req, { redirect } as unknown as Response, jest.fn());
    finishSave(new Error('Session store unavailable'));

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('https://client.example/login?error=session_failed');
  });

  it('does not take a return destination from callback query parameters', () => {
    const { req, finishSave } = callbackRequest({
      returnTo: 'https://untrusted.example',
      redirect: '//untrusted.example',
    });
    const redirect = jest.fn();

    completeLogin(req, { redirect } as unknown as Response, jest.fn());
    finishSave();

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('https://client.example/app');
  });

  it('keeps the authentication-failure path registered with Passport', () => {
    expect(passport.authenticate).toHaveBeenCalledWith('google', {
      failureRedirect: 'https://client.example/login?error=auth_failed',
      failureMessage: true,
    });
  });
});
