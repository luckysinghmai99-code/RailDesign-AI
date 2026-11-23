import type { NextFunction, Request, Response } from 'express';
import { resolveSessionUser } from './authService.ts';
import type { UserProfile } from '../../shared/types.ts';

export interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
  authToken?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveSessionUser(req);
  if (!resolved) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.authUser = resolved.user;
  req.authToken = resolved.token;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveSessionUser(req);
  if (!resolved) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (resolved.user.role !== 'admin' && resolved.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  req.authUser = resolved.user;
  req.authToken = resolved.token;
  next();
}

// Sliding window rate limiter supporting high concurrency
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: { windowMs: number; maxRequests: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);

    if (!existing || existing.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before sending additional requests.',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
