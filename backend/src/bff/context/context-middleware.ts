// License: The GPL version 3, or LGPL version 3 (Dual License).
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithContext } from '../../common/context.js';
import type { AppLogger } from '../../common/logging.js';

const TRACE_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Gives every request a `traceId` (propagated from X-Request-Id when well formed). */
export function contextMiddleware(logger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header('x-request-id');
    const traceId = incoming !== undefined && TRACE_ID.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', traceId);
    const started = Date.now();
    res.on('finish', () => {
      logger.info('request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    runWithContext({ traceId }, next);
  };
}
