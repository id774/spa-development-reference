// License: The GPL version 3, or LGPL version 3 (Dual License).
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../../src/common/cursor.js';
import { createCore } from '../support/core.js';
import { administrator, requester } from '../support/fakes.js';

describe('cursor pagination', () => {
  it('orders by updatedAt desc then id asc and round-trips an opaque cursor', async () => {
    const core = createCore();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const created = await core.requests.create(
        requester,
        { title: `R${i}`, description: '' },
        'r@example.com',
      );
      ids.push(created.id);
      if (i < 3) core.clock.advance(1000); // the last three share one timestamp: tie-break by id
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await core.requests.list(requester, { limit: 2, ...(cursor ? { cursor } : {}) });
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    // Newest timestamp first; equal timestamps by ascending id.
    expect(seen.slice(0, 2)).toEqual(ids.slice(3).sort().slice(0, 2));
  });

  it('omits nextCursor on the last page', async () => {
    const core = createCore();
    await core.requests.create(requester, { title: 'x', description: '' }, 'r@example.com');
    const page = await core.requests.list(requester, { limit: 5 });
    expect(page.nextCursor).toBeUndefined();
  });

  it('rejects a cursor from another endpoint, another request, or another filter', async () => {
    const core = createCore();
    const keyset = {
      at: new Date('2026-01-01T00:00:00Z'),
      id: '00000000-0000-4000-8000-000000000001',
    };
    const requestsCursor = encodeCursor('requests', '', keyset);
    await expect(
      core.audit.list(administrator, { limit: 5, cursor: requestsCursor }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    const attachmentCursor = encodeCursor('attachments', 'request-a', keyset);
    expect(() => decodeCursor(attachmentCursor, 'attachments', 'request-b')).toThrow();
    const auditCursor = encodeCursor('audit', 'req-1', keyset);
    await expect(
      core.audit.list(administrator, {
        limit: 5,
        cursor: auditCursor,
        requestId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      core.audit.list(administrator, { limit: 5, cursor: 'not-a-cursor' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('audit lists newest events first', async () => {
    const core = createCore();
    const created = await core.requests.create(
      requester,
      { title: 'x', description: '' },
      'r@example.com',
    );
    core.clock.advance(1000);
    await core.requests.submit(requester, created.id, 1);
    const page = await core.audit.list(administrator, { limit: 10 });
    expect(page.items.map((e) => e.eventType)).toEqual(['REQUEST_SUBMITTED', 'REQUEST_CREATED']);
    const filtered = await core.audit.list(administrator, { limit: 10, requestId: created.id });
    expect(filtered.items).toHaveLength(2);
    await expect(core.audit.list(requester, { limit: 10 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
