// backend/src/bff/errors/problem.ts: Problem Details mapping and writer
//
// Description:
// Maps any thrown value to a stable application error and writes it as an
// application/problem+json response with the stable code and the trace
// identifier.
//
// Unknown errors become INTERNAL_ERROR without exposing their messages. Server
// errors are logged with a bounded, secret-free diagnostic; client errors are
// logged at info level.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
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

import type { Request, Response } from 'express';
import { currentContext } from '../../common/context.js';
import { AppError, ERROR_STATUS, ERROR_TITLE, type ErrorCode } from '../../common/errors.js';
import { describeError, type AppLogger } from '../../common/logging.js';

interface HttpLikeError {
  type?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  getStatus?: () => number;
}

/** Maps any thrown value to an application error without exposing its details. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const candidate = (error ?? {}) as HttpLikeError;
  const status = candidate.getStatus?.() ?? candidate.status ?? candidate.statusCode;
  if (candidate.code === 'LIMIT_FILE_SIZE' || candidate.type === 'entity.too.large') {
    return new AppError('PAYLOAD_TOO_LARGE', 'The request is larger than the allowed size.');
  }
  if (candidate.code === 'LIMIT_UNEXPECTED_FILE' || candidate.type === 'entity.parse.failed') {
    return new AppError('VALIDATION_ERROR', 'The request body could not be parsed.');
  }
  if (candidate.type === 'encoding.unsupported' || candidate.type === 'charset.unsupported') {
    return new AppError('UNSUPPORTED_MEDIA_TYPE');
  }
  if (status === 404) return new AppError('ROUTE_NOT_FOUND');
  if (status === 405) return new AppError('METHOD_NOT_ALLOWED');
  if (status === 413) return new AppError('PAYLOAD_TOO_LARGE');
  if (status === 415) return new AppError('UNSUPPORTED_MEDIA_TYPE');
  if (status === 400) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR', undefined, { cause: error });
}

/** Writes an `application/problem+json` response with the stable `code` and the `traceId`. */
export function sendProblem(req: Request, res: Response, error: unknown, logger: AppLogger): void {
  const appError = toAppError(error);
  const code: ErrorCode = appError.code;
  const status = ERROR_STATUS[code];
  const traceId = currentContext()?.traceId ?? 'unknown';

  if (status >= 500) {
    logger.error('request failed', {
      code,
      status,
      error: describeError(appError.cause ?? error),
    });
  } else {
    logger.info('request rejected', { code, status });
  }
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const body = {
    type: 'about:blank',
    title: ERROR_TITLE[code],
    status,
    ...(appError.detail === undefined ? {} : { detail: appError.detail }),
    instance: req.originalUrl.split('?')[0],
    code,
    traceId,
  };
  res
    .status(status)
    .set('Content-Type', 'application/problem+json; charset=utf-8')
    .send(JSON.stringify(body));
}
