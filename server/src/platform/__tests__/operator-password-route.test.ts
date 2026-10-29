import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import router from '../routes';
import { findOperatorByEmail, findOperatorById, changeOperatorPassword } from '../store';
import { hashPassword, verifyPassword } from '../../auth/password';

const mockSession = { operatorId: '', operatorVersion: 0, operatorAuthAt: 0, regenerate: jest.fn(), save: jest.fn(), destroy: jest.fn() };
jest.mock('express-session', () => ({ __esModule: true, default: () => (req: Request, _res: Response, next: NextFunction) => {
  req.session = mockSession as unknown as Request['session']; next();
} }));
jest.mock('connect-pg-simple', () => ({ __esModule: true, default: () => class { close() {} } }));
jest.mock('../../auth/request-security', () => ({ requireTrustedOrigin: (_req: Request, _res: Response, next: NextFunction) => next() }));
jest.mock('../../auth/password', () => ({ ...jest.requireActual('../../auth/password'), hashPassword: jest.fn(), verifyPassword: jest.fn() }));
jest.mock('../store', () => ({ ensureControlSchema: jest.fn().mockResolvedValue(undefined), getControlPool: jest.fn(),
  findOperatorByEmail: jest.fn(), findOperatorById: jest.fn(), changeOperatorPassword: jest.fn() }));

const operator = { id: 'operator', email: 'operator@example.invalid', name: 'Operator', sessionVersion: 3 };
const body = { currentPassword: 'Original-password!', newPassword: 'Replacement-password!' };
const app = express(); app.use(express.json()); app.use('/api/console', router);
const originalSecret = process.env.CONSOLE_SESSION_SECRET;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.CONSOLE_SESSION_SECRET = 'x'.repeat(48);
  Object.assign(mockSession, { operatorId: operator.id, operatorVersion: 3, operatorAuthAt: 0,
    regenerate: jest.fn((done) => done()), save: jest.fn((done) => done()), destroy: jest.fn((done) => done()) });
  (findOperatorById as jest.Mock).mockResolvedValue(operator);
  (findOperatorByEmail as jest.Mock).mockResolvedValue({ ...operator, passwordHash: 'old-hash' });
  (verifyPassword as jest.Mock).mockResolvedValue(true);
  (hashPassword as jest.Mock).mockResolvedValue('new-hash');
  (changeOperatorPassword as jest.Mock).mockResolvedValue({ ...operator, sessionVersion: 4 });
});
afterAll(() => {
  if (originalSecret === undefined) delete process.env.CONSOLE_SESSION_SECRET;
  else process.env.CONSOLE_SESSION_SECRET = originalSecret;
});

it('requires fresh current-password proof before hashing or changing credentials', async () => {
  (verifyPassword as jest.Mock).mockResolvedValue(false);
  const result = await request(app).post('/api/console/password').send(body);
  expect(result.status).toBe(403); expect(result.body.error).toBe('CURRENT_PASSWORD_INVALID');
  expect(hashPassword).not.toHaveBeenCalled(); expect(changeOperatorPassword).not.toHaveBeenCalled();
});

it('does not renew a session when the compare-and-swap loses a race', async () => {
  (changeOperatorPassword as jest.Mock).mockRejectedValue(Object.assign(new Error('changed'), { status: 409 }));
  const result = await request(app).post('/api/console/password').send(body);
  expect(result.status).toBe(409); expect(result.body.error).toBe('OPERATOR_CREDENTIALS_CHANGED');
  expect(mockSession.regenerate).not.toHaveBeenCalled();
});

it('renews current session version and authentication time after the committed rotation', async () => {
  const result = await request(app).post('/api/console/password').send(body);
  expect(result.status).toBe(200);
  expect(changeOperatorPassword).toHaveBeenCalledWith({ id: operator.id, expectedVersion: 3, expectedHash: 'old-hash', passwordHash: 'new-hash' });
  expect(mockSession.regenerate).toHaveBeenCalledTimes(1); expect(mockSession.save).toHaveBeenCalledTimes(1);
  expect(mockSession.operatorVersion).toBe(4); expect(mockSession.operatorAuthAt).toBeGreaterThan(0);
});

it.each(['regenerate', 'save'])('instructs new-password sign-in after a committed change when %s fails', async (operation) => {
  mockSession[operation].mockImplementation((done: (error: Error) => void) => done(new Error('Session storage unavailable')));
  const result = await request(app).post('/api/console/password').send(body);
  expect(result.status).toBe(503); expect(result.body.error).toBe('PASSWORD_CHANGED_SIGN_IN_REQUIRED');
  expect(result.body.message).toContain('new password');
  expect(result.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('ez.operator.sid=;')]));
  expect(changeOperatorPassword).toHaveBeenCalledTimes(1);
  expect(mockSession.destroy).toHaveBeenCalledTimes(1);
});
