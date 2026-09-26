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
 * Send a new invitation
 * Auth: Admin only
 */
router.post('/', isAuthenticated, isAdmin, inviteController.sendInvite);

/**
 * POST /api/invites/accept
 * Accept an invitation
 * Auth: Public (no authentication required)
 */
router.post('/accept', inviteController.acceptInvite);

/**
 * GET /api/invites/validate
 * Validate invitation token
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
 * Resend invitation email
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
