import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z, ZodError } from 'zod';
import { isAuthenticated } from './middleware';
import { prisma } from '@/database/client';
import { getTenantByCode, activateOwner } from '@/platform/store';
import { runWithTenant } from '@/tenancy/context';
import { currentTenantDto } from './session-context';
import { hashPassword, verifyPassword, newPasswordSchema } from './password';
import { loginIpLimiter, loginAccountLimiter } from './request-security';
import { uploadsEnabled } from '@/upload/storage-policy';

const router = Router();
const companyCode = z.string().trim().toUpperCase().regex(/^[A-Z][0-9]{4}[A-Z]$/);
const email = z.string().trim().toLowerCase().email().max(254);
const loginInput = z.object({ tenantCode: companyCode, email, password: z.string().min(1).max(128) }).strict();
const activationInput = z.object({ tenantCode: companyCode, token: z.string().min(32).max(256), password: newPasswordSchema }).strict();
// Spend the same password-verification work for an unknown account/code. This
// hash has no corresponding account and is never a bootstrap credential.
const absentAccountHash = hashPassword(crypto.randomBytes(32).toString('hex'));
const userDto = (user: any) => ({ id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role });
const unavailable = (_req: Request, res: Response) => res.status(503).json({
  success: false, error: 'CAPABILITY_DISABLED', message: 'This integration is not enabled',
});

router.get('/capabilities', (_req, res) => res.json({
  success: true, passwordEnabled: true, googleEnabled: false, driveEnabled: false, aiEnabled: false, uploadEnabled: uploadsEnabled(),
}));
// Old tabs/bookmarks can still navigate to Google after a release. Send browser
// navigations to password login; API clients keep the disabled-capability JSON.
router.get(['/google', '/google/callback'], (req, res, next) => {
  if (req.accepts(['json', 'html']) !== 'html') return next();
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, '/login?error=google_disabled');
});
router.use('/google', unavailable);
router.use('/drive', unavailable);

router.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res, next) => {
  try {
    const input = loginInput.parse(req.body);
    const tenant = await getTenantByCode(input.tenantCode);
    if (!tenant || tenant.status !== 'ACTIVE') {
      await verifyPassword(input.password, await absentAccountHash);
      res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Company code, email or password is incorrect' });
      return;
    }
    await runWithTenant(tenant, async () => {
      const user = await prisma.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } } });
      const passwordMatches = await verifyPassword(input.password, user?.passwordHash || await absentAccountHash);
      if (!user || !user.isActive || !user.passwordHash || !passwordMatches) {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Company code, email or password is incorrect' });
        return;
      }
      // Passport regenerates the session before serializing. Attach tenant/version
      // only afterward so it cannot retain or discard the wrong workspace.
      await new Promise<void>((resolve, reject) => req.login(user, (error) => error ? reject(error) : resolve()));
      req.session.tenantId = tenant.id;
      req.session.sessionVersion = user.sessionVersion;
      req.session.issuedAt = Date.now();
      req.session.workspaceContext = crypto.randomUUID();
      await new Promise<void>((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, workspaceContext: req.session.workspaceContext, user: userDto(user), tenant: { id: tenant.id, code: tenant.code, name: tenant.name } });
    });
  } catch (error) { handleError(error, res, next); }
});

router.post('/activate', loginIpLimiter, async (req, res, next) => {
  try {
    const input = activationInput.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const result = await activateOwner({ tenantCode: input.tenantCode, token: input.token, passwordHash });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, user: userDto(result.user), tenant: { id: result.tenant.id, code: result.tenant.code, name: result.tenant.name } });
  } catch (error) { handleError(error, res, next); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const sessionId = req.sessionID;
    await new Promise<void>((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    const { disconnectSessionSockets } = await import('@/chat/socket-server');
    await disconnectSessionSockets(sessionId);
    res.clearCookie('connect.sid', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) { next(error); }
});

router.get('/me', isAuthenticated, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, workspaceContext: req.session.workspaceContext, user: userDto(req.user), tenant: currentTenantDto() });
});
router.get('/check', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const authenticated = req.isAuthenticated();
  res.json({ success: true, authenticated, user: authenticated ? userDto(req.user) : null, tenant: authenticated ? currentTenantDto() : null });
});

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Check the submitted fields', details: error.issues.map(({ path, message }) => ({ path, message })) });
  } else next(error);
}

export default router;
