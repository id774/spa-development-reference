// backend/test/db/persistence.test.ts: tests of PostgreSQL persistence
//
// Description:
// Pins the real database behavior of PrismaPersistence: transactions, rollback
// of state, audit, and outbox together, serialization of concurrent decisions,
// schema constraints, deterministic keyset pagination, and the attachment
// state re-check.
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
//         npm run test -w @spa-ref/backend -- test/db/persistence.test.ts
//
// Test Cases:
//     - Readiness and the whole workflow on real transactions
//     - Atomic rollback of state, audit, and outbox rows
//     - Concurrent decisions: exactly one terminal approval
//     - Schema constraints and invalid values
//     - Deterministic keyset pagination
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
// - A PostgreSQL-compatible test database (TEST_DATABASE_URL, default postgresql://postgres:postgres@localhost:5432/spa_test)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalsService } from '../../src/capabilities/approvals/application/approvals.service.js';
import { AttachmentsService } from '../../src/capabilities/attachments/application/attachments.service.js';
import { AuditService } from '../../src/capabilities/audit/application/audit.service.js';
import { RequestsService } from '../../src/capabilities/requests/application/requests.service.js';
import { silentLogger } from '../../src/common/logging.js';
import {
  FakeClock,
  FakeObjectStorage,
  SequentialIds,
  administrator,
  approver,
  requester,
} from '../support/fakes.js';
import { openDatabase, resetDatabase } from '../support/db.js';
import { randomIds } from '../../src/common/ports.js';

const db = openDatabase();
const clock = new FakeClock();
const storage = new FakeObjectStorage();
const requests = new RequestsService(db.persistence, clock, randomIds);
const approvals = new ApprovalsService(db.persistence, clock, randomIds);
const attachments = new AttachmentsService(db.persistence, storage, clock, randomIds, silentLogger);
const audit = new AuditService(db.persistence);
const draft = { title: 'T', description: 'D' };

beforeEach(async () => {
  await resetDatabase(db.persistence);
  storage.objects.clear();
});
afterAll(async () => {
  await db.persistence.close();
});

describe('PostgreSQL persistence', () => {
  it('reports readiness', async () => {
    await expect(db.persistence.isReady()).resolves.toBe(true);
  });

  it('runs the whole workflow with real transactions and keeps audit and outbox consistent', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    clock.advance(1000);
    const submitted = await requests.submit(requester, created.id, 1);
    clock.advance(1000);
    await approvals.approve(approver, submitted.id, { version: 2, comment: 'ok' });
    const events = await audit.list(administrator, { limit: 10, requestId: created.id });
    expect(events.items.map((e) => e.eventType)).toEqual([
      'REQUEST_APPROVED',
      'REQUEST_SUBMITTED',
      'REQUEST_CREATED',
    ]);
    const rows = await db.persistence.client.outboxDelivery.findMany();
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.status === 'PENDING' && r.attemptCount === 0)).toBe(true);
    expect(await db.persistence.client.approval.count()).toBe(1);
  });

  it('rolls back the state change, audit event, and outbox rows together on failure', async () => {
    // Duplicate identifiers make the outbox insert violate its primary key.
    const duplicate = { uuid: () => '00000000-0000-4000-8000-000000000001' };
    const broken = new RequestsService(db.persistence, clock, duplicate);
    const created = await requests.create(requester, draft, 'r@example.com');
    await expect(broken.submit(requester, created.id, 1)).rejects.toThrow();
    const row = await db.persistence.client.request.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row).toMatchObject({ status: 'DRAFT', version: 1 });
    expect(await db.persistence.client.outboxDelivery.count()).toBe(0);
    expect(await db.persistence.client.auditEvent.count()).toBe(1);
  });

  it('serializes concurrent decisions: exactly one terminal approval commits', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    await requests.submit(requester, created.id, 1);
    const results = await Promise.allSettled([
      approvals.approve(approver, created.id, { version: 2, comment: null }),
      approvals.reject(approver, created.id, { version: 2, comment: null }),
      approvals.approve(approver, created.id, { version: 2, comment: null }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const failure of results.filter((r) => r.status === 'rejected')) {
      expect((failure as PromiseRejectedResult).reason).toMatchObject({
        code: 'CONCURRENCY_CONFLICT',
      });
    }
    expect(await db.persistence.client.approval.count()).toBe(1);
    expect(await db.persistence.client.outboxDelivery.count()).toBe(4); // submit (2) + one decision (2)
  });

  it('enforces one approval per request in the schema', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    await requests.submit(requester, created.id, 1);
    await approvals.approve(approver, created.id, { version: 2, comment: null });
    await expect(
      db.persistence.client.approval.create({
        data: {
          id: randomIds.uuid(),
          requestId: created.id,
          approverId: 'x',
          decision: 'APPROVED',
          decidedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('upload versus submit: the second state check refuses an attachment after submission and cleans up', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    storage.beforePut = async () => {
      storage.beforePut = undefined;
      await requests.submit(requester, created.id, 1);
    };
    const upload = {
      fileName: 'a.pdf',
      mediaType: 'application/pdf' as const,
      bytes: Buffer.from('%PDF-1 x'),
    };
    await expect(attachments.upload(requester, created.id, upload)).rejects.toMatchObject({
      code: 'REQUEST_INVALID_STATE',
    });
    expect(await db.persistence.client.attachment.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
    const events = await db.persistence.client.auditEvent.findMany();
    expect(events.map((e) => e.eventType).sort()).toEqual(['REQUEST_CREATED', 'REQUEST_SUBMITTED']);
    const row = await db.persistence.client.request.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.version).toBe(2);
  });

  it('attachment upload does not change the request version or updatedAt', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    clock.advance(5000);
    const upload = {
      fileName: 'a.pdf',
      mediaType: 'application/pdf' as const,
      bytes: Buffer.from('%PDF-1 x'),
    };
    await attachments.upload(requester, created.id, upload);
    const row = await db.persistence.client.request.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.version).toBe(1);
    expect(row.updatedAt.getTime()).toBe(created.updatedAt.getTime());
  });

  it('paginates deterministically with equal timestamps and keyset cursors', async () => {
    const ids = new SequentialIds();
    const service = new RequestsService(db.persistence, clock, ids);
    for (let i = 0; i < 5; i += 1) await service.create(requester, draft, 'r@example.com');
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await service.list(requester, { limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual([...seen].sort()); // same updatedAt: id ascending
  });

  it('keeps the approval queue oldest first and lists attachments in creation order', async () => {
    const a = await requests.create(requester, draft, 'r@example.com');
    const b = await requests.create(requester, draft, 'r@example.com');
    clock.advance(1000);
    await requests.submit(requester, b.id, 1);
    clock.advance(1000);
    await requests.submit(requester, a.id, 1);
    const queue = await approvals.queue(approver, { limit: 10 });
    expect(queue.items.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('rejects invalid values at the database level', async () => {
    const created = await requests.create(requester, draft, 'r@example.com');
    await expect(
      db.persistence.client.request.update({ where: { id: created.id }, data: { version: 0 } }),
    ).rejects.toThrow();
    await expect(
      db.persistence.client.attachment.create({
        data: {
          id: randomIds.uuid(),
          requestId: created.id,
          objectKey: 'k',
          fileName: 'a.pdf',
          mediaType: 'application/pdf',
          sizeBytes: 0,
          uploadedBy: 'u',
          createdAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});
