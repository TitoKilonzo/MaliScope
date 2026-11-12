import type { Request, Response, NextFunction } from 'express';
import { sessionCookieName, verify, type SessionUser } from '../services/auth.js';

declare global { namespace Express { interface Request { user?: SessionUser } } }
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = verify(req.cookies?.[sessionCookieName]) ?? undefined;
  next();
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  req.user = verify(req.cookies?.[sessionCookieName]) ?? undefined;
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  req.user = verify(req.cookies?.[sessionCookieName]) ?? undefined;
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (req.user.role !== 'admin' && req.user.role !== 'editor') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}
