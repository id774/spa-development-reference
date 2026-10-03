// backend/src/outbox/ports.ts: outbox worker ports
//
// Description:
// Defines the persistence port of the outbox worker and the mail and event
// publisher ports that the AWS and local adapters implement.
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

import type { OutboxChannel, OutboxEventType } from '../capabilities/shared/ports.js';

export interface ClaimedDelivery {
  id: string;
  eventType: OutboxEventType;
  channel: OutboxChannel;
  payload: Record<string, unknown>;
  /** Attempt number of this claim, counted after the claim incremented it. */
  attemptCount: number;
  claimToken: string;
}

/** Persistence operations of the outbox worker. */
export interface OutboxStore {
  /** Re-queues (or fails, at the attempt limit) PROCESSING rows whose lease expired. */
  recoverStaleClaims(now: Date, maxAttempts: number): Promise<number>;
  /** Short claim transaction: PENDING due rows become PROCESSING with a lease. */
  claim(input: {
    now: Date;
    limit: number;
    leaseSeconds: number;
    claimToken: string;
  }): Promise<ClaimedDelivery[]>;
  /** Marks DELIVERED only while the row is still PROCESSING under the same token. */
  markDelivered(id: string, claimToken: string, now: Date): Promise<boolean>;
  /** Returns the row to PENDING (retry) or marks FAILED, under the same token. */
  markAttemptFailed(input: {
    id: string;
    claimToken: string;
    error: string;
    nextAttemptAt: Date | null;
  }): Promise<boolean>;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailSender {
  send(message: MailMessage, options: { signal: AbortSignal }): Promise<void>;
}

export interface EventMessage {
  body: string;
  eventType: string;
}

export interface EventPublisher {
  publish(message: EventMessage, options: { signal: AbortSignal }): Promise<void>;
}
