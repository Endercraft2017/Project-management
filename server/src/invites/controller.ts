import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as inviteService from './service';
import { sendInviteSchema, listInvitesQuerySchema, revokeInviteParamsSchema } from './validators';

function fail(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Check the invitation fields', details: error.issues.map(({ path, message }) => ({ path, message })) });
  } else next(error);
}

export async function sendInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = sendInviteSchema.parse(req.body);
    const invite = await inviteService.createInvite(body.email, body.role, req.user!.id, body.name);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.status(201).json({
      success: true, message: 'Invitation created. Copy the one-use activation link and share it securely; no email was sent.',
      data: invite, setupUrl: invite.setupUrl,
    });
  } catch (error) { fail(error, res, next); }
}

export async function listInvites(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listInvitesQuerySchema.parse(req.query);
    const invites = await inviteService.listInvites(query);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: invites, count: invites.length });
  } catch (error) { fail(error, res, next); }
}

export async function revokeInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = revokeInviteParamsSchema.parse(req.params);
    await inviteService.revokeInvite(id, req.user!.id);
    res.json({ success: true, message: 'Invitation revoked' });
  } catch (error) { fail(error, res, next); }
}

export function acceptInvite(_req: Request, res: Response) {
  res.status(410).json({ success: false, error: 'LEGACY_INVITATION_RETIRED', message: 'Use a current company-bound activation link to set your password. Ask your workspace administrator for a new invitation.' });
}
export const validateInvite = acceptInvite;
export function resendInvite(_req: Request, res: Response) {
  res.status(410).json({ success: false, error: 'INVITATION_LINK_NOT_RECOVERABLE', message: 'Invitation links are shown once. Revoke this invitation and create a new one to obtain another link; no email was sent.' });
}
export default { sendInvite, listInvites, revokeInvite, acceptInvite, validateInvite, resendInvite };
