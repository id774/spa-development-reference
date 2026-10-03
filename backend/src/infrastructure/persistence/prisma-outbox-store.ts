// backend/src/infrastructure/persistence/prisma-outbox-store.ts: Prisma outbox store
//
// Description:
// Implements the outbox persistence port. Raw SQL is limited to this class and
// always uses bound parameters. Rows are claimed with FOR UPDATE SKIP LOCKED
// so that several backend tasks claim distinct rows, and results are recorded
// only while the row is still processing under the same claim token.
//
// Expired claims are re-queued, or failed at the attempt limit. Delivery is
// at-least-once.
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
// - Prisma 7.10.0
// - PostgreSQL-compatible database
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import type { PrismaClient } from '../../generated/prisma/client.js';
import type { OutboxChannel, OutboxEventType } from '../../capabilities/shared/ports.js';
import type { ClaimedDelivery, OutboxStore } from '../../outbox/ports.js';

interface ClaimedRow {
  id: string;
  event_type: OutboxEventType;
  channel: OutboxChannel;
  payload: Record<string, unknown>;
  attempt_count: number;
  claim_token: string;
}

/**
 * Outbox persistence. Raw SQL is limited to this class and always uses bound
 * parameters; row selection uses FOR UPDATE SKIP LOCKED so that several
 * backend tasks claim distinct rows.
 */
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly client: PrismaClient) {}

  async recoverStaleClaims(now: Date, maxAttempts: number): Promise<number> {
    const requeued = await this.client.$executeRaw`
      UPDATE outbox_deliveries
      SET status = 'PENDING'::"OutboxStatus", claim_token = NULL, claimed_at = NULL,
          claim_expires_at = NULL, next_attempt_at = ${now}::timestamptz
      WHERE status = 'PROCESSING'::"OutboxStatus"
        AND claim_expires_at <= ${now}::timestamptz
        AND attempt_count < ${maxAttempts}::int`;
    const failed = await this.client.$executeRaw`
      UPDATE outbox_deliveries
      SET status = 'FAILED'::"OutboxStatus", claim_token = NULL, claimed_at = NULL,
          claim_expires_at = NULL,
          last_error = COALESCE(last_error, 'claim expired at the attempt limit')
      WHERE status = 'PROCESSING'::"OutboxStatus"
        AND claim_expires_at <= ${now}::timestamptz
        AND attempt_count >= ${maxAttempts}::int`;
    return requeued + failed;
  }

  async claim(input: {
    now: Date;
    limit: number;
    leaseSeconds: number;
    claimToken: string;
  }): Promise<ClaimedDelivery[]> {
    const expires = new Date(input.now.getTime() + input.leaseSeconds * 1000);
    const rows = await this.client.$transaction(
      (db) => db.$queryRaw<ClaimedRow[]>`
        WITH picked AS (
          SELECT id FROM outbox_deliveries
          WHERE status = 'PENDING'::"OutboxStatus" AND next_attempt_at <= ${input.now}::timestamptz
          ORDER BY next_attempt_at, id
          LIMIT ${input.limit}::int
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_deliveries o
        SET status = 'PROCESSING'::"OutboxStatus", attempt_count = o.attempt_count + 1,
            claim_token = ${input.claimToken}, claimed_at = ${input.now}::timestamptz,
            claim_expires_at = ${expires}::timestamptz
        FROM picked
        WHERE o.id = picked.id
        RETURNING o.id::text AS id, o.event_type::text AS event_type, o.channel::text AS channel,
                  o.payload, o.attempt_count, o.claim_token`,
      { isolationLevel: 'ReadCommitted' },
    );
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      channel: row.channel,
      payload: row.payload,
      attemptCount: row.attempt_count,
      claimToken: row.claim_token,
    }));
  }

  async markDelivered(id: string, claimToken: string, now: Date): Promise<boolean> {
    const updated = await this.client.$executeRaw`
      UPDATE outbox_deliveries
      SET status = 'DELIVERED'::"OutboxStatus", delivered_at = ${now}::timestamptz,
          claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL, last_error = NULL
      WHERE id = ${id}::uuid AND status = 'PROCESSING'::"OutboxStatus"
        AND claim_token = ${claimToken}`;
    return updated === 1;
  }

  async markAttemptFailed(input: {
    id: string;
    claimToken: string;
    error: string;
    nextAttemptAt: Date | null;
  }): Promise<boolean> {
    const error = input.error.slice(0, 1000);
    const updated =
      input.nextAttemptAt === null
        ? await this.client.$executeRaw`
            UPDATE outbox_deliveries
            SET status = 'FAILED'::"OutboxStatus", last_error = ${error},
                claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL
            WHERE id = ${input.id}::uuid AND status = 'PROCESSING'::"OutboxStatus"
              AND claim_token = ${input.claimToken}`
        : await this.client.$executeRaw`
            UPDATE outbox_deliveries
            SET status = 'PENDING'::"OutboxStatus", last_error = ${error},
                next_attempt_at = ${input.nextAttemptAt}::timestamptz,
                claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL
            WHERE id = ${input.id}::uuid AND status = 'PROCESSING'::"OutboxStatus"
              AND claim_token = ${input.claimToken}`;
    return updated === 1;
  }
}
