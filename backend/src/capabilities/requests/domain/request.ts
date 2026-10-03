// backend/src/capabilities/requests/domain/request.ts: request domain model and lifecycle rules
//
// Description:
// Defines the request record, its status values, and the lifecycle DRAFT ->
// SUBMITTED -> APPROVED | REJECTED as pure functions: which operations apply
// in which state, the version and timestamp change of a transition, ownership,
// and read visibility.
//
// It performs no I/O. Read visibility is shared by request detail, attachment
// list, and attachment download.
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

import type { Identity } from '../../shared/identity.js';

export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface RequestRecord {
  id: string;
  requesterId: string;
  /** Internal only: never part of the browser-facing representation. */
  requesterEmail: string;
  title: string;
  description: string;
  status: RequestStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type Operation = 'update' | 'submit' | 'approve' | 'reject';

/** The request lifecycle: DRAFT -> SUBMITTED -> APPROVED | REJECTED. */
export const TRANSITIONS: Record<Operation, { from: RequestStatus; to: RequestStatus }> = {
  update: { from: 'DRAFT', to: 'DRAFT' },
  submit: { from: 'DRAFT', to: 'SUBMITTED' },
  approve: { from: 'SUBMITTED', to: 'APPROVED' },
  reject: { from: 'SUBMITTED', to: 'REJECTED' },
};

export function canApply(operation: Operation, status: RequestStatus): boolean {
  return TRANSITIONS[operation].from === status;
}

/** Applies a transition: the version increments by one and `updatedAt` is set. */
export function applyOperation(
  request: RequestRecord,
  operation: Operation,
  now: Date,
  changes: Partial<Pick<RequestRecord, 'title' | 'description'>> = {},
): RequestRecord {
  return {
    ...request,
    ...changes,
    status: TRANSITIONS[operation].to,
    version: request.version + 1,
    updatedAt: now,
  };
}

export function isOwner(identity: Identity, request: RequestRecord): boolean {
  return request.requesterId === identity.subject;
}

/**
 * Read visibility shared by request detail, attachment list, and download:
 * Requester - own requests; Approver - SUBMITTED requests; Administrator - any.
 */
export function canViewRequest(identity: Identity, request: RequestRecord): boolean {
  if (identity.roles.includes('Administrator')) return true;
  if (identity.roles.includes('Requester') && isOwner(identity, request)) return true;
  if (identity.roles.includes('Approver') && request.status === 'SUBMITTED') return true;
  return false;
}
