// backend/test/application/requests.test.ts: tests of the requests capability service
//
// Description:
// Pins the request lifecycle of RequestsService on in-memory persistence:
// creation, version increments, ownership, state and version precedence,
// rollback of partial writes, outbox rows on submit, read visibility, and
// role-dependent listing.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/application/requests.test.ts
//
// Test Cases:
//     - Draft creation with audit event
//     - Version and timestamp changes of update and submit
//     - Ownership, invalid state, and stale version precedence
//     - Atomic rollback without partial audit or outbox rows
//     - Outbox rows only on submit
//     - Read visibility and role-dependent listing
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors.js';
import { createCore } from '../support/core.js';
import { administrator, approver, noRole, otherRequester, requester } from '../support/fakes.js';
import { InMemoryPersistence } from '../support/in-memory-persistence.js';

const content = { title: 'Laptop', description: 'Need a laptop' };

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('request lifecycle', () => {
  it('creates a DRAFT request owned by the caller with an audit event', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    expect(created).toMatchObject({
      requesterId: requester.subject,
      requesterEmail: 'r@example.com',
      status: 'DRAFT',
      version: 1,
    });
    const events = (core.persistence as InMemoryPersistence).snapshot.audit;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'REQUEST_CREATED',
      fromState: null,
      toState: 'DRAFT',
      actorId: requester.subject,
    });
  });

  it('only a Requester can create', async () => {
    const core = createCore();
    await expectCode(core.requests.create(approver, content, 'a@example.com'), 'FORBIDDEN');
    await expectCode(core.requests.create(administrator, content, 'a@example.com'), 'FORBIDDEN');
  });

  it('increments the version on update and submit and sets updatedAt', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    core.clock.advance(1000);
    const updated = await core.requests.updateDraft(requester, created.id, {
      title: 'New',
      description: 'Changed',
      version: 1,
    });
    expect(updated).toMatchObject({ title: 'New', version: 2, status: 'DRAFT' });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    const submitted = await core.requests.submit(requester, created.id, 2);
    expect(submitted).toMatchObject({ status: 'SUBMITTED', version: 3 });
  });

  it('enforces ownership', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    await expectCode(core.requests.submit(otherRequester, created.id, 1), 'FORBIDDEN');
    await expectCode(
      core.requests.updateDraft(otherRequester, created.id, { ...content, version: 1 }),
      'FORBIDDEN',
    );
  });

  it('rejects invalid states', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    await core.requests.submit(requester, created.id, 1);
    await expectCode(core.requests.submit(requester, created.id, 2), 'REQUEST_INVALID_STATE');
    await expectCode(
      core.requests.updateDraft(requester, created.id, { ...content, version: 2 }),
      'REQUEST_INVALID_STATE',
    );
    await expectCode(
      core.approvals.approve(approver, 'missing-id', { version: 1, comment: null }),
      'REQUEST_NOT_FOUND',
    );
  });

  it('a stale version wins over an invalid state', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    await core.requests.submit(requester, created.id, 1);
    // Version 1 is stale and the request is no longer a draft: the version error comes first.
    await expectCode(core.requests.submit(requester, created.id, 1), 'CONCURRENCY_CONFLICT');
    // A matching version with an invalid state is an invalid-state error.
    await expectCode(core.requests.submit(requester, created.id, 2), 'REQUEST_INVALID_STATE');
  });

  it('rolls back everything when a write fails (no partial audit or outbox rows)', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const created = await core.requests.create(requester, content, 'r@example.com');
    persistence.failOnCommit = () => new Error('commit failed');
    await expect(core.requests.submit(requester, created.id, 1)).rejects.toThrow('commit failed');
    persistence.failOnCommit = undefined;
    expect(persistence.snapshot.requests.get(created.id)?.status).toBe('DRAFT');
    expect(persistence.snapshot.outbox).toHaveLength(0);
    expect(persistence.snapshot.audit).toHaveLength(1);
  });

  it('records EMAIL and EVENT outbox rows with the submit transition', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const created = await core.requests.create(requester, content, 'r@example.com');
    await core.requests.submit(requester, created.id, 1);
    const rows = persistence.snapshot.outbox;
    expect(rows.map((r) => r.channel).sort()).toEqual(['EMAIL', 'EVENT']);
    const email = rows.find((r) => r.channel === 'EMAIL');
    const event = rows.find((r) => r.channel === 'EVENT');
    expect(email?.payload).toEqual({
      to: 'r@example.com',
      eventType: 'REQUEST_SUBMITTED',
      requestId: created.id,
      title: 'Laptop',
      status: 'SUBMITTED',
    });
    expect(event?.payload).toMatchObject({
      eventId: event?.id,
      eventType: 'REQUEST_SUBMITTED',
      requestId: created.id,
      actorId: requester.subject,
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      version: 2,
    });
  });

  it('creating and updating a draft create no outbox rows', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const created = await core.requests.create(requester, content, 'r@example.com');
    await core.requests.updateDraft(requester, created.id, { ...content, version: 1 });
    expect(persistence.snapshot.outbox).toHaveLength(0);
    expect(persistence.snapshot.audit.map((e) => e.eventType)).toEqual([
      'REQUEST_CREATED',
      'REQUEST_UPDATED',
    ]);
  });

  it('applies read visibility', async () => {
    const core = createCore();
    const created = await core.requests.create(requester, content, 'r@example.com');
    await expect(core.requests.get(requester, created.id)).resolves.toBeDefined();
    await expect(core.requests.get(administrator, created.id)).resolves.toBeDefined();
    await expectCode(core.requests.get(otherRequester, created.id), 'FORBIDDEN');
    await expectCode(core.requests.get(approver, created.id), 'FORBIDDEN');
    await core.requests.submit(requester, created.id, 1);
    await expect(core.requests.get(approver, created.id)).resolves.toBeDefined();
    await expectCode(core.requests.get(noRole, created.id), 'FORBIDDEN');
    await expectCode(
      core.requests.get(requester, '00000000-0000-4000-8000-0000000000ff'),
      'REQUEST_NOT_FOUND',
    );
  });

  it('lists own requests for a Requester and all requests for an Administrator', async () => {
    const core = createCore();
    await core.requests.create(requester, content, 'r@example.com');
    await core.requests.create(otherRequester, content, 'o@example.com');
    expect((await core.requests.list(requester, { limit: 50 })).items).toHaveLength(1);
    expect((await core.requests.list(administrator, { limit: 50 })).items).toHaveLength(2);
    const both = { subject: requester.subject, roles: ['Requester', 'Administrator'] as const };
    expect((await core.requests.list(both, { limit: 50 })).items).toHaveLength(2);
    await expectCode(core.requests.list(approver, { limit: 50 }), 'FORBIDDEN');
  });

  it('is an AppError with a stable code', async () => {
    const core = createCore();
    const error = await core.requests.get(requester, 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
  });
});
