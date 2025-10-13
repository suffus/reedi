import { Request, Response, NextFunction } from 'express';
import { Authentication } from '../types/permissions';
import { User } from '@prisma/client';

/**
 * Extended Express Request with auth context
 */
export interface AuthenticatedRequest extends Request {
  authContext?: Authentication;
}

/**
 * Extract authentication context from Express request
 */
export function buildAuthContext(req: Request): Authentication {
  const user = (req as any).user as User | undefined;
  const userId = user?.id || null;
  
  return {
    user: user || null,
    userId,
    sessionId: req.headers['x-session-id'] as string,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim(),
    userAgent: req.headers['user-agent'],
    requestId: (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    jwt: req.headers.authorization?.replace('Bearer ', '')
  };
}

/**
 * Middleware to attach auth context to request
 * Should be applied after authentication middleware
 */
export function attachAuthContext() {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).authContext = buildAuthContext(req);
    next();
  };
}

/**
 * Helper to get auth context from request (with fallback)
 */
export function getAuthContext(req: Request): Authentication {
  const authReq = req as AuthenticatedRequest;
  return authReq.authContext || buildAuthContext(req);
}

