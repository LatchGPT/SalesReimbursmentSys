import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../../lib/db/serverTypes';
import { state } from '../state';

export function getUser(req: Request): User | undefined {
  const userId = req.header('X-User-Id');
  if (!userId) return undefined;
  return state.users.find(u => u.id === userId || u.entra_object_id === userId || u.user_principal_name === userId);
}

export function financeReadOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  const isRead = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  const isSelfService = req.path === '/me/notification-prefs' || req.path.startsWith('/support');
  if (user?.role === UserRole.FINANCE && !isRead && !isSelfService) {
    return res.status(403).json({ error: 'Finance access is view-only.' });
  }
  next();
}
