import { Router, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword, newPasswordSchema } from '../auth/password';
import { requireTrustedOrigin } from '../auth/request-security';
import operatorSetupRouter from './operator-setup-routes';
import { mfaConfigured, operatorMfaEnabled, beginMfaEnrollment, confirmMfaEnrollment, verifyOperatorMfa } from './operator-mfa';
import type { Operator } from './store';
import {
  ensureControlSchema, getControlPool, findOperatorByEmail, findOperatorById,
  createTenant, listTenants, updateTenant, publicTenant, listAudit,
  createOwnerSetupLink, changeOperatorPassword,
} from './store';

declare module 'express-session' {
  interface SessionData { operatorId?: string; operatorVersion?: number; operatorAuthAt?: number;
    operatorPendingMfaId?: string; operatorPendingMfaVersion?: number; operatorPendingMfaAt?: number; }
}

const router = Router();
const PgSession = connectPgSimple(session);
let operatorStore: InstanceType<typeof PgSession> | undefined;
let middleware: ReturnType<typeof session> | undefined;
let dummyHash: Promise<string> | undefined;

export async function closeConsoleSessions(): Promise<void> {
  operatorStore?.close(); operatorStore = undefined; middleware = undefined;
}

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!process.env.CONSOLE_SESSION_SECRET || process.env.CONSOLE_SESSION_SECRET.length < 32) {
    res.status(503).json({ success: false, message: 'Operator console is not configured' }); return;
  }
  next();
});
router.use(requireTrustedOrigin);
router.use(operatorSetupRouter);
router.use((req, res, next) => {
  ensureControlSchema().then(() => {
    if (!middleware) {
      operatorStore = new PgSession({ pool: getControlPool(), schemaName: 'ez_control', tableName: 'operator_sessions', createTableIfMissing: false, pruneSessionInterval: 900 });
      middleware = session({ store: operatorStore, secret: process.env.CONSOLE_SESSION_SECRET!,
        name: 'ez.operator.sid', resave: false, saveUninitialized: false,
        cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 12 * 60 * 60 * 1000, path: '/api/console' },
      });
    }
    middleware(req, res, next);
  }).catch(() => next(Object.assign(new Error('Operator database unavailable'), { status: 503 })));
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many operator sign-in attempts; try later' } });
const mutationLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many operator changes; try later' } });
const mfaLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many MFA attempts; wait five minutes and try again' } });
const mfaAccountLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.session.operatorPendingMfaId || req.session.operatorId || `ip:${req.ip}`,
  message: { success: false, message: 'Too many MFA attempts; wait five minutes and try again' } });
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict();
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: newPasswordSchema }).strict();
const createSchema = z.object({ name: z.string().trim().min(1).max(120), ownerName: z.string().trim().min(1).max(120),
  ownerEmail: z.string().email().max(254), storageLimitBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  aiTokenLimit: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),seatLimit:z.number().int().min(1).max(10000).optional() }).strict();
const patchSchema = createSchema.pick({ name: true, storageLimitBytes: true, aiTokenLimit: true,seatLimit:true }).partial()
  .extend({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional() }).strict()
  .refine((value) => Object.keys(value).length > 0, 'Choose a workspace change');
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch((error) => {
    if (error instanceof z.ZodError) { res.status(400).json({ success: false, message: 'Invalid operator request' }); return; }
    next(error);
  });
};
const mfaHandle = (fn: (req: Request, res: Response) => Promise<unknown>) => handle(async (req, res) => {
  try { await fn(req, res); } catch (error) {
    if (error instanceof z.ZodError) throw error;
    const status = Number((error as { status?: number }).status);
    if ([400,401,409,503].includes(status)) {
      res.status(status).json({ success: false, message: (error as Error).message }); return;
    }
    throw error;
  }
});
async function establishOperatorSession(req: Request, operator: Operator): Promise<void> {
  await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.operatorId = operator.id; req.session.operatorVersion = operator.sessionVersion; req.session.operatorAuthAt = Date.now();
  req.session.cookie.maxAge = 12 * 60 * 60 * 1000;
  await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}
async function renewAfterMfa(req: Request, res: Response, operator: Operator): Promise<boolean> {
  try { await establishOperatorSession(req, operator); return true; }
  catch {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve())).catch(() => undefined);
    res.clearCookie('ez.operator.sid', { path: '/api/console', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    return false;
  }
}

router.post('/login', loginLimiter, handle(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const operator = await findOperatorByEmail(input.email);
  dummyHash ||= hashPassword(randomBytes(24).toString('hex'));
  const valid = await verifyPassword(input.password, operator?.passwordHash || await dummyHash);
  if (!operator || !valid) { res.status(401).json({ success: false, message: 'Invalid email or password' }); return; }
  if (await operatorMfaEnabled(operator.id)) {
    if (!mfaConfigured()) { res.status(503).json({ success: false, message: 'Operator MFA is unavailable; contact your platform operator' }); return; }
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.operatorPendingMfaId = operator.id; req.session.operatorPendingMfaVersion = operator.sessionVersion; req.session.operatorPendingMfaAt = Date.now();
    req.session.cookie.maxAge = 5 * 60 * 1000;
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.json({ success: true, mfaRequired: true }); return;
  }
  await establishOperatorSession(req, operator);
  res.json({ success: true, user: { id: operator.id, email: operator.email, name: operator.name } });
}));

router.post('/mfa/verify', mfaLimiter, mfaAccountLimiter, mfaHandle(async (req, res) => {
  const { token } = z.object({ token: z.string().min(6).max(64) }).strict().parse(req.body);
  const id = req.session.operatorPendingMfaId, version = req.session.operatorPendingMfaVersion, at = req.session.operatorPendingMfaAt;
  if (!id || version === undefined || !at || Date.now()-at > 5*60*1000) {
    res.status(401).json({ success: false, message: 'Sign in again before entering your authenticator code' }); return;
  }
  const operator = await verifyOperatorMfa(id, version, token.trim());
  if (!await renewAfterMfa(req, res, operator)) {
    res.status(503).json({ success: false, message: 'Sign in again; a recovery code used for this attempt has already been consumed' }); return;
  }
  res.json({ success: true, user: { id: operator.id, email: operator.email, name: operator.name } });
}));

router.use((req, res, next) => {
  (async () => {
    const operator = req.session.operatorId ? await findOperatorById(req.session.operatorId) : null;
    if (!operator || operator.sessionVersion !== req.session.operatorVersion) {
      res.status(401).json({ success: false, message: 'Operator sign-in required' }); return;
    }
    res.locals.operator = operator;
    next();
  })().catch(next);
});

router.get('/me', (_req, res) => {
  const { id, email, name } = res.locals.operator;
  res.json({ success: true, user: { id, email, name } });
});
router.get('/mfa', mfaHandle(async (_req, res) => {
  res.json({ success: true, configured: mfaConfigured(), enabled: await operatorMfaEnabled(res.locals.operator.id) });
}));
router.post('/mfa/enrollment', mfaLimiter, mfaAccountLimiter, mfaHandle(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).strict().parse(req.body);
  const current = await findOperatorByEmail(res.locals.operator.email);
  if (!current || current.sessionVersion !== req.session.operatorVersion || !await verifyPassword(password, current.passwordHash)) {
    res.status(403).json({ success: false, error: 'CURRENT_PASSWORD_INVALID', message: 'Current password could not be verified' }); return;
  }
  res.json({ success: true, ...await beginMfaEnrollment(current) });
}));
router.post('/mfa/enable', mfaLimiter, mfaAccountLimiter, mfaHandle(async (req, res) => {
  const { token } = z.object({ token: z.string().regex(/^\d{6}$/) }).strict().parse(req.body);
  const result = await confirmMfaEnrollment(res.locals.operator.id, req.session.operatorVersion!, token);
  const renewed = await renewAfterMfa(req, res, result.operator);
  res.json({ success: true, enabled: true, recoveryCodes: result.recoveryCodes, signInRequired: !renewed });
}));
router.post('/mfa/disable', mfaLimiter, mfaAccountLimiter, mfaHandle(async (req, res) => {
  const { password, token } = z.object({ password: z.string().min(1).max(200), token: z.string().min(6).max(64) }).strict().parse(req.body);
  const current = await findOperatorByEmail(res.locals.operator.email);
  if (!current || current.sessionVersion !== req.session.operatorVersion || !await verifyPassword(password, current.passwordHash)) {
    res.status(403).json({ success: false, error: 'CURRENT_PASSWORD_INVALID', message: 'Current password could not be verified' }); return;
  }
  const operator = await verifyOperatorMfa(current.id, current.sessionVersion, token.trim(), true);
  const renewed = await renewAfterMfa(req, res, operator);
  res.json({ success: true, enabled: false, signInRequired: !renewed });
}));
router.post('/password', mutationLimiter, handle(async (req, res) => {
  const input = passwordSchema.parse(req.body);
  const current = await findOperatorByEmail(res.locals.operator.email);
  if (!current || current.id !== res.locals.operator.id || current.sessionVersion !== req.session.operatorVersion) {
    res.status(409).json({ success: false, error: 'OPERATOR_CREDENTIALS_CHANGED', message: 'Operator credentials changed; sign in again' }); return;
  }
  if (!await verifyPassword(input.currentPassword, current.passwordHash)) {
    res.status(403).json({ success: false, error: 'CURRENT_PASSWORD_INVALID', message: 'Current password could not be verified' }); return;
  }
  if (input.currentPassword === input.newPassword) {
    res.status(400).json({ success: false, error: 'PASSWORD_UNCHANGED', message: 'Choose a different password' }); return;
  }
  const passwordHash = await hashPassword(input.newPassword);
  let operator;
  try {
    operator = await changeOperatorPassword({ id: current.id, expectedVersion: current.sessionVersion, expectedHash: current.passwordHash, passwordHash });
  } catch (error) {
    if ((error as { status?: number }).status === 409) {
      res.status(409).json({ success: false, error: 'OPERATOR_CREDENTIALS_CHANGED', message: 'Operator credentials changed; sign in again' }); return;
    }
    throw error;
  }
  // Credentials/audit commit together. A failed cookie renewal must never restore
  // the old password; all old session versions remain revoked.
  try {
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.operatorId = operator.id; req.session.operatorVersion = operator.sessionVersion; req.session.operatorAuthAt = Date.now();
    await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
  } catch {
    // Detach the failed session so express-session cannot retry saving its
    // authenticated fields while sending this failure response.
    await new Promise<void>((resolve) => req.session.destroy(() => resolve())).catch(() => undefined);
    res.clearCookie('ez.operator.sid', { path: '/api/console', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    res.status(503).json({ success: false, error: 'PASSWORD_CHANGED_SIGN_IN_REQUIRED', message: 'Password changed. Sign in again using your new password' }); return;
  }
  res.json({ success: true });
}));
router.post('/logout', handle(async (req, res) => {
  await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
  res.clearCookie('ez.operator.sid', { path: '/api/console', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true });
}));
router.get('/tenants', handle(async (_req, res) => {
  res.json({ success: true, data: (await listTenants()).map(publicTenant) });
}));
router.post('/tenants', mutationLimiter, handle(async (req, res) => {
  const input = createSchema.parse(req.body);
  const { tenant, setupToken } = await createTenant(input as Required<Pick<typeof input, 'name' | 'ownerEmail' | 'ownerName'>> & typeof input, res.locals.operator.id);
  const query = new URLSearchParams({ tenantCode: tenant.code, token: setupToken });
  res.status(201).json({ success: true, data: publicTenant(tenant), setupUrl: `/activate?${query.toString()}` });
}));
router.patch('/tenants/:id', mutationLimiter, handle(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const patch = patchSchema.parse(req.body);
  res.json({ success: true, data: publicTenant(await updateTenant(id, patch, res.locals.operator.id)) });
}));
router.post('/tenants/:id/owner-setup',mutationLimiter,handle(async(req,res)=>{
  if(!req.session.operatorAuthAt||Date.now()-req.session.operatorAuthAt>15*60*1000){
    res.status(403).json({success:false,error:'OPERATOR_REAUTH_REQUIRED',message:'Sign in again before issuing an owner recovery link'});return;
  }
  const id=z.string().uuid().parse(req.params.id);
  const {tenant,setupToken}=await createOwnerSetupLink(id,res.locals.operator.id);
  res.json({success:true,data:publicTenant(tenant),setupUrl:`/activate?${new URLSearchParams({tenantCode:tenant.code,token:setupToken})}`,expiresInSeconds:3600});
}));
router.get('/audit', handle(async (_req, res) => { res.json({ success: true, data: await listAudit() }); }));

router.use((_req, res) => { res.status(404).json({ success: false, message: 'Unknown operator endpoint' }); });
router.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  // Control-plane errors never log request bodies, setup tokens or provider connection strings.
  const status = Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 500;
  res.status(status).json({ success: false, message: status < 500 ? error.message : 'Operator request could not be completed' });
});

export default router;
