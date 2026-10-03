// backend/src/common/cursor.ts: opaque keyset pagination cursors
//
// Description:
// Encodes and decodes the opaque cursors of the list endpoints and builds a
// page from a limit + 1 probe row. A cursor carries its format version,
// endpoint kind, bound filter value, and last sort key, and any mismatch is
// rejected as a validation error.
//
// Clients never interpret a cursor, so the encoding can change without
// changing the API contract.
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

import { AppError } from './errors.js';

/** Position in a stable keyset sort: a timestamp followed by a unique id. */
export interface Keyset {
  at: Date;
  id: string;
}

export type CursorKind = 'requests' | 'approvals' | 'attachments' | 'audit';

interface CursorPayload {
  v: 1;
  k: CursorKind;
  b: string;
  t: string;
  i: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cursors are opaque to clients. This internal encoding carries the format
 * version, the endpoint kind, the bound filter value, and the last sort key.
 */
export function encodeCursor(kind: CursorKind, binding: string, last: Keyset): string {
  const payload: CursorPayload = {
    v: 1,
    k: kind,
    b: binding,
    t: last.at.toISOString(),
    i: last.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string, kind: CursorKind, binding: string): Keyset {
  const invalid = () =>
    new AppError('VALIDATION_ERROR', 'The cursor is not valid for this request.');
  let payload: Partial<CursorPayload>;
  try {
    payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<CursorPayload>;
  } catch {
    throw invalid();
  }
  if (
    payload.v !== 1 ||
    payload.k !== kind ||
    payload.b !== binding ||
    typeof payload.t !== 'string' ||
    typeof payload.i !== 'string' ||
    !UUID.test(payload.i)
  ) {
    throw invalid();
  }
  const at = new Date(payload.t);
  if (Number.isNaN(at.getTime())) throw invalid();
  return { at, id: payload.i };
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export interface ListInput {
  limit: number;
  cursor?: string | undefined;
}

export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

/** Trims the limit+1 probe row and builds the next cursor when more rows exist. */
export function buildPage<T>(
  rows: T[],
  limit: number,
  key: (row: T) => Keyset,
  kind: CursorKind,
  binding: string,
): PageResult<T> {
  if (rows.length <= limit) return { items: rows };
  const items = rows.slice(0, limit);
  const last = items[items.length - 1] as T;
  return { items, nextCursor: encodeCursor(kind, binding, key(last)) };
}
