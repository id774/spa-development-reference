// backend/src/common/errors.ts: stable application error identifiers
//
// Description:
// Defines the stable application error codes with their HTTP statuses and
// titles, and the AppError type used for expected failures.
//
// The detail of an AppError is shown to clients, so it must never contain
// provider messages, SQL, stack traces, or secrets. The codes are specified in
// doc/DETAILED_DESIGN.md.
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

/** Stable application error identifiers (DETAILED_DESIGN section 20). */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  REQUEST_NOT_FOUND: 404,
  ATTACHMENT_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_INVALID_STATE: 409,
  CONCURRENCY_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  IDENTITY_PROVIDER_UNAVAILABLE: 503,
  OBJECT_STORAGE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ERROR_TITLE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Validation error',
  AUTHENTICATION_REQUIRED: 'Authentication required',
  FORBIDDEN: 'Forbidden',
  REQUEST_NOT_FOUND: 'Request not found',
  ATTACHMENT_NOT_FOUND: 'Attachment not found',
  ROUTE_NOT_FOUND: 'Route not found',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  REQUEST_INVALID_STATE: 'Invalid state transition',
  CONCURRENCY_CONFLICT: 'Concurrency conflict',
  PAYLOAD_TOO_LARGE: 'Payload too large',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported media type',
  IDENTITY_PROVIDER_UNAVAILABLE: 'Identity provider unavailable',
  OBJECT_STORAGE_UNAVAILABLE: 'Object storage unavailable',
  INTERNAL_ERROR: 'Internal error',
};

/**
 * An expected application failure. `detail` is shown to clients, so it must
 * never contain provider messages, SQL, stack traces, or secrets.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail: string | undefined;

  constructor(code: ErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ?? ERROR_TITLE[code], options);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
