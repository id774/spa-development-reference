// License: The GPL version 3, or LGPL version 3 (Dual License).
import { describe, expect, it } from 'vitest';
import { createCore, type Core } from '../support/core.js';
import { administrator, approver, requester } from '../support/fakes.js';
import { InMemoryPersistence } from '../support/in-memory-persistence.js';

async function submitted(core: Core) {
  const created = await core.requests.create(
    requester,
    { title: 'T', description: 'D' },
    'r@example.com',
  );
  return core.requests.submit(requester, created.id, 1);
}

describe('approvals', () => {
  it('approves a SUBMITTED request in one transaction', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await submitted(core);
    core.clock.advance(5000);
    const approved = await core.approvals.approve(approver, request.id, {
      version: 2,
      comment: 'ok',
    });
    expect(approved).toMatchObject({ status: 'APPROVED', version: 3 });
    const { approvals, audit, outbox } = persistence.snapshot;
    expect([...approvals.values()]).toHaveLength(1);
    expect([...approvals.values()][0]).toMatchObject({
      approverId: approver.subject,
      decision: 'APPROVED',
      comment: 'ok',
    });
    const event = audit.at(-1);
    expect(event).toMatchObject({
      eventType: 'REQUEST_APPROVED',
      fromState: 'SUBMITTED',
      toState: 'APPROVED',
      details: { approvalId: [...approvals.values()][0]?.id },
    });
    expect(
      outbox
        .filter((r) => r.eventType === 'REQUEST_APPROVED')
        .map((r) => r.channel)
        .sort(),
    ).toEqual(['EMAIL', 'EVENT']);
  });

  it('rejects with the REJECTED transition and audit', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await submitted(core);
    const rejected = await core.approvals.reject(approver, request.id, {
      version: 2,
      comment: null,
    });
    expect(rejected.status).toBe('REJECTED');
    expect(persistence.snapshot.audit.at(-1)).toMatchObject({
      eventType: 'REQUEST_REJECTED',
      toState: 'REJECTED',
    });
  });

  it('allows only one terminal decision', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await submitted(core);
    const results = await Promise.allSettled([
      core.approvals.approve(approver, request.id, { version: 2, comment: null }),
      core.approvals.reject(approver, request.id, { version: 2, comment: null }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ code: 'CONCURRENCY_CONFLICT' });
    expect(persistence.snapshot.approvals.size).toBe(1);
  });

  it('requires the Approver role and a SUBMITTED request', async () => {
    const core = createCore();
    const created = await core.requests.create(
      requester,
      { title: 'T', description: 'D' },
      'r@example.com',
    );
    await expect(
      core.approvals.approve(administrator, created.id, { version: 1, comment: null }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      core.approvals.approve(approver, created.id, { version: 1, comment: null }),
    ).rejects.toMatchObject({
      code: 'REQUEST_INVALID_STATE',
    });
  });

  it('queues SUBMITTED requests oldest first', async () => {
    const core = createCore();
    const first = await core.requests.create(
      requester,
      { title: 'A', description: '' },
      'r@example.com',
    );
    const second = await core.requests.create(
      requester,
      { title: 'B', description: '' },
      'r@example.com',
    );
    core.clock.advance(1000);
    await core.requests.submit(requester, second.id, 1);
    core.clock.advance(1000);
    await core.requests.submit(requester, first.id, 1);
    const queue = await core.approvals.queue(approver, { limit: 10 });
    expect(queue.items.map((r) => r.id)).toEqual([second.id, first.id]);
    await expect(core.approvals.queue(requester, { limit: 10 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
