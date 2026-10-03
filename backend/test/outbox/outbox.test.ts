// License: The GPL version 3, or LGPL version 3 (Dual License).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RequestsService } from '../../src/capabilities/requests/application/requests.service.js';
import { silentLogger } from '../../src/common/logging.js';
import { randomIds } from '../../src/common/ports.js';
import { OutboxWorker, composeEmail } from '../../src/outbox/outbox-worker.js';
import type {
  EventMessage,
  EventPublisher,
  MailMessage,
  MailSender,
} from '../../src/outbox/ports.js';
import { openDatabase, resetDatabase } from '../support/db.js';
import { FakeClock, requester } from '../support/fakes.js';

const db = openDatabase();
const clock = new FakeClock();
const requests = new RequestsService(db.persistence, clock, randomIds);
const settings = {
  pollIntervalMs: 5,
  maxAttempts: 5,
  retryDelaysSeconds: [30, 120, 600, 1800],
  claimLeaseSeconds: 60,
  providerTimeoutMs: 15000,
  batchSize: 10,
};

class RecordingMail implements MailSender {
  sent: MailMessage[] = [];
  failing = false;
  async send(message: MailMessage): Promise<void> {
    if (this.failing) throw new Error('SES rejected: Bearer abc.def.ghi');
    this.sent.push(message);
  }
}
class RecordingEvents implements EventPublisher {
  published: EventMessage[] = [];
  failing = false;
  async publish(message: EventMessage): Promise<void> {
    if (this.failing) throw new Error('SNS down');
    this.published.push(message);
  }
}

function makeWorker(mail = new RecordingMail(), events = new RecordingEvents()) {
  const worker = new OutboxWorker(
    db.outbox,
    mail,
    events,
    clock,
    randomIds,
    silentLogger,
    settings,
  );
  return { worker, mail, events };
}

async function submitOne() {
  const created = await requests.create(
    requester,
    { title: 'Order', description: 'secret details' },
    'r@example.com',
  );
  return requests.submit(requester, created.id, 1);
}
const rows = () => db.persistence.client.outboxDelivery.findMany({ orderBy: { channel: 'asc' } });

beforeEach(async () => {
  await resetDatabase(db.persistence);
  clock.set(new Date('2026-01-01T00:00:00.000Z'));
});
afterAll(async () => {
  await db.persistence.close();
});

describe('outbox delivery', () => {
  it('delivers EMAIL and EVENT rows and marks them DELIVERED', async () => {
    const request = await submitOne();
    const { worker, mail, events } = makeWorker();
    expect(await worker.tick()).toBe(2);
    expect(mail.sent).toEqual([
      {
        to: 'r@example.com',
        subject: 'Request submitted',
        text: expect.stringContaining(`Request ID: ${request.id}`),
      },
    ]);
    expect(mail.sent[0]?.text).toContain('Title: Order');
    expect(mail.sent[0]?.text).toContain('Status: SUBMITTED');
    expect(mail.sent[0]?.text).not.toContain('secret details');
    const published = JSON.parse(events.published[0]?.body ?? '{}');
    expect(events.published[0]?.eventType).toBe('REQUEST_SUBMITTED');
    expect(published).toMatchObject({
      eventType: 'REQUEST_SUBMITTED',
      requestId: request.id,
      toStatus: 'SUBMITTED',
      version: 2,
    });
    const stored = await rows();
    expect(
      stored.every(
        (r) => r.status === 'DELIVERED' && r.deliveredAt !== null && r.claimToken === null,
      ),
    ).toBe(true);
    expect(published.eventId).toBe(stored.find((r) => r.channel === 'EVENT')?.id);
    expect(await worker.tick()).toBe(0);
  });

  it('tracks each channel independently and keeps the business commit when delivery fails', async () => {
    const request = await submitOne();
    const { worker, mail } = makeWorker(new RecordingMail(), new RecordingEvents());
    mail.failing = true;
    await worker.tick();
    const byChannel = Object.fromEntries((await rows()).map((r) => [r.channel, r]));
    expect(byChannel['EVENT']).toMatchObject({ status: 'DELIVERED' });
    expect(byChannel['EMAIL']).toMatchObject({ status: 'PENDING', attemptCount: 1 });
    expect(byChannel['EMAIL']?.lastError).not.toMatch(/abc\.def\.ghi/);
    const stored = await db.persistence.client.request.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(stored.status).toBe('SUBMITTED');
  });

  it('follows the retry schedule and fails permanently on the fifth failed attempt', async () => {
    await submitOne();
    const { worker, mail } = makeWorker();
    mail.failing = true;
    const expectedDelays = [30, 120, 600, 1800];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await worker.tick();
      const email = (await rows()).find((r) => r.channel === 'EMAIL');
      expect(email).toMatchObject({ status: 'PENDING', attemptCount: attempt });
      const delay = expectedDelays[attempt - 1] as number;
      expect(email?.nextAttemptAt.getTime()).toBe(clock.now().getTime() + delay * 1000);
      // Not due yet: nothing is claimed one second early.
      clock.advance(delay * 1000 - 1000);
      expect(await worker.tick()).toBe(0);
      clock.advance(1000);
    }
    await worker.tick();
    const email = (await rows()).find((r) => r.channel === 'EMAIL');
    expect(email).toMatchObject({ status: 'FAILED', attemptCount: 5 });
    clock.advance(10_000_000);
    expect(await worker.tick()).toBe(0); // automatic retry stopped
  });

  it('excludes concurrent claimers: no row is claimed twice', async () => {
    for (let i = 0; i < 6; i += 1) await submitOne();
    const claims = await Promise.all(
      [1, 2, 3].map((n) =>
        db.outbox.claim({
          now: clock.now(),
          limit: 12,
          leaseSeconds: 60,
          claimToken: `token-${n}`,
        }),
      ),
    );
    const ids = claims.flat().map((c) => c.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    for (const [index, claim] of claims.entries()) {
      expect(
        claim.every((c) => c.claimToken === `token-${index + 1}` && c.attemptCount === 1),
      ).toBe(true);
    }
  });

  it('recovers a stale claim, re-sends it (at-least-once), and rejects the stale worker result', async () => {
    await submitOne();
    const [stale] = await db.outbox.claim({
      now: clock.now(),
      limit: 1,
      leaseSeconds: 60,
      claimToken: 'old-worker',
    });
    expect(stale).toBeDefined();
    // Within the lease the row is not eligible.
    expect(
      await db.outbox.claim({ now: clock.now(), limit: 5, leaseSeconds: 60, claimToken: 'x' }),
    ).toHaveLength(1); // the other channel row
    clock.advance(61_000);
    const { worker, mail, events } = makeWorker();
    await worker.tick();
    // The crashed worker's row was recovered and delivered again by a new claim.
    expect((await rows()).find((r) => r.id === stale?.id)).toMatchObject({
      status: 'DELIVERED',
      attemptCount: 2,
    });
    // Both rows (the recovered one and its sibling) were sent by the new worker.
    expect(mail.sent.length + events.published.length).toBe(2);
    // The old worker finishing late must not overwrite the newer result.
    expect(await db.outbox.markDelivered(stale!.id, 'old-worker', clock.now())).toBe(false);
    expect(
      await db.outbox.markAttemptFailed({
        id: stale!.id,
        claimToken: 'old-worker',
        error: 'late',
        nextAttemptAt: null,
      }),
    ).toBe(false);
    expect((await rows()).find((r) => r.id === stale?.id)).toMatchObject({
      status: 'DELIVERED',
      lastError: null,
    });
  });

  it('marks a stale claim FAILED at the attempt limit instead of calling the provider again', async () => {
    await submitOne();
    await db.persistence.client.$executeRawUnsafe(
      `UPDATE outbox_deliveries SET status = 'PROCESSING'::"OutboxStatus", attempt_count = 5, claim_token = 't', claim_expires_at = now() - interval '1 second' WHERE channel = 'EMAIL'::"OutboxChannel"`,
    );
    const { worker, mail } = makeWorker();
    clock.set(new Date(Date.now() + 5_000));
    await worker.tick();
    expect(mail.sent).toHaveLength(0);
    expect((await rows()).find((r) => r.channel === 'EMAIL')).toMatchObject({
      status: 'FAILED',
      claimToken: null,
    });
  });

  it('stops gracefully', async () => {
    const { worker } = makeWorker();
    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await worker.stop();
    await worker.stop();
  });

  it('composes the fixed subjects without leaking other fields', () => {
    for (const [eventType, subject] of [
      ['REQUEST_SUBMITTED', 'Request submitted'],
      ['REQUEST_APPROVED', 'Request approved'],
      ['REQUEST_REJECTED', 'Request rejected'],
    ] as const) {
      const mail = composeEmail({
        eventType,
        payload: {
          to: 'a@example.com',
          requestId: 'id',
          title: 'T',
          status: 'S',
          description: 'nope',
        },
      });
      expect(mail.subject).toBe(subject);
      expect(mail.text).not.toContain('nope');
    }
  });
});
