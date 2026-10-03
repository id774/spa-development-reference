// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../common/errors.js';

const ID = '[^/]+';

/** The browser-facing routes and the methods each supports. */
const ROUTES: ReadonlyArray<{ pattern: RegExp; methods: readonly string[] }> = [
  { pattern: /^\/api\/session$/, methods: ['GET'] },
  { pattern: /^\/api\/requests$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^/api/requests/${ID}$`), methods: ['GET', 'PUT'] },
  { pattern: new RegExp(`^/api/requests/${ID}/submit$`), methods: ['POST'] },
  { pattern: new RegExp(`^/api/requests/${ID}/approve$`), methods: ['POST'] },
  { pattern: new RegExp(`^/api/requests/${ID}/reject$`), methods: ['POST'] },
  { pattern: /^\/api\/approvals$/, methods: ['GET'] },
  { pattern: new RegExp(`^/api/requests/${ID}/attachments$`), methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^/api/requests/${ID}/attachments/${ID}$`), methods: ['GET'] },
  { pattern: /^\/api\/admin\/audit$/, methods: ['GET'] },
];

/**
 * Runs before authentication: an unknown path is 404 ROUTE_NOT_FOUND and a
 * known path with an unsupported method is 405 METHOD_NOT_ALLOWED.
 */
export function routeTable(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/') && req.path !== '/api') {
    next();
    return;
  }
  const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
  const matches = ROUTES.filter((route) => route.pattern.test(path));
  if (matches.length === 0) {
    next(new AppError('ROUTE_NOT_FOUND'));
    return;
  }
  const allowed = matches.flatMap((route) => route.methods);
  if (!allowed.includes(req.method)) {
    res.set('Allow', allowed.join(', '));
    next(new AppError('METHOD_NOT_ALLOWED'));
    return;
  }
  next();
}
