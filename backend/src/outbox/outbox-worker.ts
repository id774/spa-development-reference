// backend/src/outbox/outbox-worker.ts: transactional outbox worker
//
// Description:
// Polls for due outbox rows, claims them, and delivers them by email or event
// publication. Provider calls happen outside any database transaction and are
// bounded by a timeout.
//
// Delivery is at-least-once: a provider call that succeeded just before a
// crash is repeated after the claim lease expires. Retry delays, the attempt
// limit, and the lease are settings; their semantics are specified in
// doc/DETAILED_DESIGN.md. Emails contain the request identifier, title, and
// status only.
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

import { describeError, type AppLogger } from '../common/logging.js';
import type { Clock, IdGenerator } from '../common/ports.js';
import type { OutboxEventType } from '../capabilities/shared/ports.js';
import type { ClaimedDelivery, EventPublisher, MailSender, OutboxStore } from './ports.js';

export interface OutboxSettings {
  pollIntervalMs: number;
  maxAttempts: number;
  retryDelaysSeconds: readonly number[];
  claimLeaseSeconds: number;
  providerTimeoutMs: number;
  batchSize: number;
}

const SUBJECTS: Record<OutboxEventType, string> = {
  REQUEST_SUBMITTED: 'Request submitted',
  REQUEST_APPROVED: 'Request approved',
  REQUEST_REJECTED: 'Request rejected',
};

/** Plain-text email: request ID, title, and status only. */
export function composeEmail(delivery: Pick<ClaimedDelivery, 'eventType' | 'payload'>) {
  const { payload } = delivery;
  return {
    to: String(payload['to']),
    subject: SUBJECTS[delivery.eventType],
    text: [
      SUBJECTS[delivery.eventType] + '.',
      '',
      `Request ID: ${String(payload['requestId'])}`,
      `Title: ${String(payload['title'])}`,
      `Status: ${String(payload['status'])}`,
      '',
    ].join('\n'),
  };
}

/**
 * Delivers committed outbox rows. Provider calls happen outside any database
 * transaction. Delivery is at-least-once: a provider call that succeeded just
 * before a crash is repeated after the lease expires.
 */
export class OutboxWorker {
  private running = false;
  private loop: Promise<void> | undefined;
  private wake: (() => void) | undefined;

  constructor(
    private readonly store: OutboxStore,
    private readonly mail: MailSender,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: AppLogger,
    private readonly settings: OutboxSettings,
  ) {}

  /** One poll cycle: recover stale claims, claim due rows, deliver them. */
  async tick(): Promise<number> {
    await this.store.recoverStaleClaims(this.clock.now(), this.settings.maxAttempts);
    const claimed = await this.store.claim({
      now: this.clock.now(),
      limit: this.settings.batchSize,
      leaseSeconds: this.settings.claimLeaseSeconds,
      claimToken: this.ids.uuid(),
    });
    for (const delivery of claimed) {
      await this.deliver(delivery);
    }
    return claimed.length;
  }

  private async deliver(delivery: ClaimedDelivery): Promise<void> {
    const signal = AbortSignal.timeout(this.settings.providerTimeoutMs);
    try {
      if (delivery.channel === 'EMAIL') {
        await this.mail.send(composeEmail(delivery), { signal });
      } else {
        await this.events.publish(
          { body: JSON.stringify(delivery.payload), eventType: delivery.eventType },
          { signal },
        );
      }
    } catch (error) {
      await this.recordFailure(delivery, error);
      return;
    }
    const recorded = await this.store.markDelivered(
      delivery.id,
      delivery.claimToken,
      this.clock.now(),
    );
    if (!recorded) {
      this.logger.warn('delivery result discarded because the claim was replaced', {
        deliveryId: delivery.id,
      });
    }
  }

  private async recordFailure(delivery: ClaimedDelivery, error: unknown): Promise<void> {
    const now = this.clock.now();
    const isLastAttempt = delivery.attemptCount >= this.settings.maxAttempts;
    const delaySeconds = this.settings.retryDelaysSeconds[delivery.attemptCount - 1];
    const nextAttemptAt =
      isLastAttempt || delaySeconds === undefined
        ? null
        : new Date(now.getTime() + delaySeconds * 1000);
    this.logger.warn('outbox delivery failed', {
      deliveryId: delivery.id,
      channel: delivery.channel,
      attempt: delivery.attemptCount,
      final: nextAttemptAt === null,
      error: describeError(error),
    });
    await this.store.markAttemptFailed({
      id: delivery.id,
      claimToken: delivery.claimToken,
      error: describeError(error),
      nextAttemptAt,
    });
  }

  start(): void {
    if (this.loop) return;
    this.running = true;
    this.loop = this.run();
  }

  /** Graceful shutdown: finishes the in-flight cycle and stops polling. */
  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loop;
    this.loop = undefined;
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        this.logger.error('outbox cycle failed', { error: describeError(error) });
      }
      if (!this.running) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.settings.pollIntervalMs);
        this.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  }
}
