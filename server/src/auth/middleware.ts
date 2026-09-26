/**
 * Authentication Middleware
 * Protects routes and checks permissions
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Extend Express Request type to include user
 */
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      picture: string | null;
      role: Role;
      isActive: boolean;
    }
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }

  // Prevent caching of auth error responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'You must be logged in to access this resource',
  });
}

/**
 * Check if user has admin role
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'You must be logged in to access this resource',
    });
    return;
  }

  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
}

/**
 * Check if user is admin or the resource owner
 * Requires userId parameter or body field
 */
export function isAdminOrOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'You must be logged in to access this resource',
    });
    return;
  }

  const currentUserId = req.user?.id;
  const targetUserId = req.params.userId || req.body.userId;

  // Admin can access anything
  if (req.user?.role === Role.ADMIN) {
    return next();
  }

  // User can access their own resources
  if (currentUserId === targetUserId) {
    return next();
  }

  res.status(403).json({
    success: false,
    error: 'Forbidden',
    message: 'You can only access your own resources',
  });
}

/**
 * Check if user has specific role(s)
 */
export function hasRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Attach user to response locals for easy access in views
 */
export function attachUser(req: Request, res: Response, next: NextFunction): void {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
}
