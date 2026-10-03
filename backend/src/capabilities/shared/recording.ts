// backend/src/capabilities/shared/recording.ts: audit and notification recording helpers
//
// Description:
// Writes an audit event and the EMAIL and EVENT outbox rows inside the
// caller's transaction, so that the business state change, its audit event,
// and its delivery intent commit or fail together.
//
// The email recipient is the address captured on the request at creation, and
// the outbox payloads carry only the fields the delivery needs.
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

import type { IdGenerator } from '../../common/ports.js';
import type { RequestRecord, RequestStatus } from '../requests/domain/request.js';
import type { AuditEventType, OutboxEventType, OutboxRow, Repositories } from './ports.js';

/** Writes one audit event inside the caller's transaction. */
export async function recordAudit(
  repositories: Repositories,
  ids: IdGenerator,
  event: {
    requestId: string;
    eventType: AuditEventType;
    actorId: string;
    fromState: RequestStatus | null;
    toState: RequestStatus | null;
    details?: Record<string, unknown> | null;
    at: Date;
  },
): Promise<void> {
  await repositories.audit.insert({
    id: ids.uuid(),
    requestId: event.requestId,
    eventType: event.eventType,
    actorId: event.actorId,
    fromState: event.fromState,
    toState: event.toState,
    details: event.details ?? null,
    occurredAt: event.at,
  });
}

/**
 * Records the EMAIL and EVENT delivery intent for a transition, in the same
 * transaction as the state change. The email recipient is the address captured
 * on the request at creation.
 */
export async function recordNotifications(
  repositories: Repositories,
  ids: IdGenerator,
  notification: {
    eventType: OutboxEventType;
    request: RequestRecord;
    fromStatus: RequestStatus;
    actorId: string;
    at: Date;
  },
): Promise<void> {
  const { request, eventType, fromStatus, actorId, at } = notification;
  const emailId = ids.uuid();
  const eventId = ids.uuid();
  const base = { aggregateId: request.id, eventType, status: 'PENDING' as const, attemptCount: 0 };
  const rows: OutboxRow[] = [
    {
      ...base,
      id: emailId,
      channel: 'EMAIL',
      payload: {
        to: request.requesterEmail,
        eventType,
        requestId: request.id,
        title: request.title,
        status: request.status,
      },
      nextAttemptAt: at,
      createdAt: at,
    },
    {
      ...base,
      id: eventId,
      channel: 'EVENT',
      payload: {
        eventId,
        eventType,
        occurredAt: at.toISOString(),
        requestId: request.id,
        actorId,
        fromStatus,
        toStatus: request.status,
        version: request.version,
      },
      nextAttemptAt: at,
      createdAt: at,
    },
  ];
  await repositories.outbox.insertMany(rows);
}
