/**
 * Invitation Routes
 * API endpoints for managing team invitations
 */

import { Router } from 'express';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import * as inviteController from './controller';

const router = Router();

/**
 * POST /api/invites
 * Create a copy-once account activation link (no automatic email)
 * Auth: Admin only
 */
router.post('/', isAuthenticated, isAdmin, inviteController.sendInvite);

/**
 * POST /api/invites/accept
 * Retired: use company-bound /api/auth/activate with a password
 * Auth: Public (no authentication required)
 */
router.post('/accept', inviteController.acceptInvite);

/**
 * GET /api/invites/validate
 * Retired: legacy invitation tokens are not accepted
 * Auth: Public (no authentication required)
 */
router.get('/validate', inviteController.validateInvite);

/**
 * GET /api/invites
 * List all invitations
 * Auth: Admin only
 */
router.get('/', isAuthenticated, isAdmin, inviteController.listInvites);

/**
 * POST /api/invites/:id/resend
 * Retired: setup links are non-recoverable; revoke and recreate
 * Auth: Admin only
 */
router.post('/:id/resend', isAuthenticated, isAdmin, inviteController.resendInvite);

/**
 * DELETE /api/invites/:id
 * Revoke an invitation
 * Auth: Admin only
 */
router.delete('/:id', isAuthenticated, isAdmin, inviteController.revokeInvite);

export default router;
