// backend/src/bff/context/context-middleware.ts: request context and trace identifier middleware
//
// Description:
// Gives every request a trace identifier, propagated from a well-formed
// X-Request-Id header or generated, returns it in the X-Request-Id response
// header, and runs the rest of the request inside an AsyncLocalStorage
// context.
//
// It also logs one completion line per request with method, path, status, and
// duration, and never logs headers, tokens, or bodies.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
