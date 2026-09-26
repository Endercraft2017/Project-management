/**
 * Invitation Controller
 * Request handlers for invitation endpoints
 */

import { Request, Response, NextFunction } from 'express';
import * as inviteService from './service';
import {
  sendInviteSchema,
  acceptInviteSchema,
  listInvitesQuerySchema,
  revokeInviteParamsSchema,
  getInviteByTokenSchema,
} from './validators';
import { ZodError } from 'zod';

/**
 * POST /api/invites
 * Send a new invitation (Admin only)
 */
export async function sendInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = sendInviteSchema.parse(req.body);
    const invitedById = req.user!.id;

    const invite = await inviteService.createInvite(body.email, body.role, invitedById);

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    if (error.message.includes('already exists') || error.message.includes('already active')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message,
      });
    }

    console.error('[Invites] Error sending invitation:', error);
    next(error);
  }
}

/**
 * POST /api/invites/accept
 * Accept an invitation (Public)
 */
export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const body = acceptInviteSchema.parse(req.body);

    const result = await inviteService.acceptInvite(body.token, {
      name: body.name,
      googleId: body.googleId,
      picture: body.picture,
    });

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        user: result.user,
        invite: {
          id: result.invite.id,
          acceptedAt: result.invite.acceptedAt,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    if (
      error.message.includes('Invalid invitation') ||
      error.message.includes('expired') ||
      error.message.includes('revoked') ||
      error.message.includes('already been accepted')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Invitation',
        message: error.message,
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: error.message,
      });
    }

    console.error('[Invites] Error accepting invitation:', error);
    next(error);
  }
}

/**
 * GET /api/invites
 * List all invitations (Admin only)
 */
export async function listInvites(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listInvitesQuerySchema.parse(req.query);

    const invites = await inviteService.listInvites({
      status: query.status,
      email: query.email,
    });

    res.status(200).json({
      success: true,
      data: invites,
      count: invites.length,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    console.error('[Invites] Error listing invitations:', error);
    next(error);
  }
}

/**
 * DELETE /api/invites/:id
 * Revoke an invitation (Admin only)
 */
export async function revokeInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const params = revokeInviteParamsSchema.parse({ id: req.params.id });
    const revokedById = req.user!.id;

    await inviteService.revokeInvite(params.id, revokedById);

    res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('Only pending')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    console.error('[Invites] Error revoking invitation:', error);
    next(error);
  }
}

/**
 * POST /api/invites/:id/resend
 * Resend invitation email (Admin only)
 */
export async function resendInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const params = revokeInviteParamsSchema.parse({ id: req.params.id });

    await inviteService.resendInvite(params.id);

    res.status(200).json({
      success: true,
      message: 'Invitation email resent successfully',
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
    }

    if (error.message.includes('Only pending') || error.message.includes('expired')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
    }

    console.error('[Invites] Error resending invitation:', error);
    next(error);
  }
}

/**
 * GET /api/invites/validate
 * Validate invitation token (Public)
 */
export async function validateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getInviteByTokenSchema.parse(req.query);

    const invite = await inviteService.getInviteByToken(query.token);

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invalid invitation token',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        email: invite.email,
        role: invite.role,
        status: invite.status,
        invitedBy: invite.invitedBy.name,
        expiresAt: invite.expiresAt,
        isValid: invite.isValid,
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors[0].message,
        details: error.errors,
      });
    }

    console.error('[Invites] Error validating invitation:', error);
    next(error);
  }
}

export default {
  sendInvite,
  acceptInvite,
  listInvites,
  revokeInvite,
  resendInvite,
  validateInvite,
};
