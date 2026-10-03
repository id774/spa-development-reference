// License: The GPL version 3, or LGPL version 3 (Dual License).
import { describe, expect, it } from 'vitest';
import { createCore } from '../support/core.js';
import { administrator, approver, otherRequester, requester } from '../support/fakes.js';
import { InMemoryPersistence } from '../support/in-memory-persistence.js';

const pdf = {
  fileName: 'doc.pdf',
  mediaType: 'application/pdf' as const,
  bytes: Buffer.from('%PDF-1.4 x'),
};

async function draft(core: ReturnType<typeof createCore>) {
  return core.requests.create(requester, { title: 'T', description: 'D' }, 'r@example.com');
}

describe('attachments service', () => {
  it('uploads to a DRAFT request: S3 key without file name, metadata, audit, no version change', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await draft(core);
    const attachment = await core.attachments.upload(requester, request.id, pdf);
    expect(attachment.objectKey).toBe(`attachments/${request.id}/${attachment.id}`);
    expect(attachment.objectKey).not.toContain('doc.pdf');
    expect(core.storage.objects.get(attachment.objectKey)?.contentType).toBe('application/pdf');
    expect(persistence.snapshot.requests.get(request.id)).toMatchObject({ version: 1 });
    expect(persistence.snapshot.audit.at(-1)).toMatchObject({
      eventType: 'ATTACHMENT_ADDED',
      fromState: 'DRAFT',
      toState: 'DRAFT',
      details: { attachmentId: attachment.id },
    });
    expect(persistence.snapshot.outbox).toHaveLength(0);
  });

  it('requires Requester, ownership, and DRAFT', async () => {
    const core = createCore();
    const request = await draft(core);
    await expect(core.attachments.upload(approver, request.id, pdf)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(core.attachments.upload(otherRequester, request.id, pdf)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await core.requests.submit(requester, request.id, 1);
    await expect(core.attachments.upload(requester, request.id, pdf)).rejects.toMatchObject({
      code: 'REQUEST_INVALID_STATE',
    });
    expect(core.storage.objects.size).toBe(0);
  });

  it('does not add an attachment when the request is submitted during a slow transfer, and cleans up', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await draft(core);
    // The submit commits while the S3 transfer is still in flight.
    core.storage.beforePut = async () => {
      core.storage.beforePut = undefined;
      await core.requests.submit(requester, request.id, 1);
    };
    await expect(core.attachments.upload(requester, request.id, pdf)).rejects.toMatchObject({
      code: 'REQUEST_INVALID_STATE',
    });
    expect(persistence.snapshot.attachments.size).toBe(0);
    expect(core.storage.objects.size).toBe(0);
    expect(persistence.snapshot.audit.map((e) => e.eventType)).not.toContain('ATTACHMENT_ADDED');
  });

  it('maps an S3 failure to OBJECT_STORAGE_UNAVAILABLE without committing metadata', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await draft(core);
    core.storage.failPut = true;
    await expect(core.attachments.upload(requester, request.id, pdf)).rejects.toMatchObject({
      code: 'OBJECT_STORAGE_UNAVAILABLE',
    });
    expect(persistence.snapshot.attachments.size).toBe(0);
  });

  it('attempts orphan cleanup when the metadata transaction fails, and survives a cleanup failure', async () => {
    const persistence = new InMemoryPersistence();
    const core = createCore(persistence);
    const request = await draft(core);
    persistence.failOnCommit = () => new Error('commit failed');
    core.storage.failDelete = true;
    await expect(core.attachments.upload(requester, request.id, pdf)).rejects.toThrow(
      'commit failed',
    );
    // The failed upload is not converted into success even though cleanup failed.
    expect(persistence.snapshot.attachments.size).toBe(0);
    expect(core.storage.objects.size).toBe(1);
  });

  it('lists attachments with the download visibility, in createdAt order', async () => {
    const core = createCore();
    const request = await draft(core);
    const first = await core.attachments.upload(requester, request.id, pdf);
    core.clock.advance(1000);
    const second = await core.attachments.upload(requester, request.id, {
      ...pdf,
      fileName: 'b.pdf',
    });
    const page = await core.attachments.list(requester, request.id, { limit: 1 });
    expect(page.items.map((a) => a.id)).toEqual([first.id]);
    const next = await core.attachments.list(requester, request.id, {
      limit: 1,
      cursor: page.nextCursor as string,
    });
    expect(next.items.map((a) => a.id)).toEqual([second.id]);
    expect(next.nextCursor).toBeUndefined();

    await expect(core.attachments.list(approver, request.id, { limit: 5 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      core.attachments.list(otherRequester, request.id, { limit: 5 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      core.attachments.list(administrator, request.id, { limit: 5 }),
    ).resolves.toBeDefined();
    await core.requests.submit(requester, request.id, 1);
    await expect(core.attachments.list(approver, request.id, { limit: 5 })).resolves.toBeDefined();
    await expect(
      core.attachments.list(requester, request.id, { limit: 5, cursor: page.nextCursor as string }),
    ).resolves.toBeDefined();
  });

  it('rejects an attachment cursor reused with another request', async () => {
    const core = createCore();
    const a = await draft(core);
    const b = await draft(core);
    await core.attachments.upload(requester, a.id, pdf);
    core.clock.advance(1);
    await core.attachments.upload(requester, a.id, pdf);
    const page = await core.attachments.list(requester, a.id, { limit: 1 });
    await expect(
      core.attachments.list(requester, b.id, { limit: 1, cursor: page.nextCursor as string }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('downloads only through the request the attachment belongs to', async () => {
    const core = createCore();
    const a = await draft(core);
    const b = await draft(core);
    const attachment = await core.attachments.upload(requester, a.id, pdf);
    const ok = await core.attachments.download(requester, a.id, attachment.id);
    expect(ok.attachment.id).toBe(attachment.id);
    await expect(core.attachments.download(requester, b.id, attachment.id)).rejects.toMatchObject({
      code: 'ATTACHMENT_NOT_FOUND',
    });
    await expect(core.attachments.download(approver, a.id, attachment.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    core.storage.failGet = true;
    await expect(core.attachments.download(requester, a.id, attachment.id)).rejects.toMatchObject({
      code: 'OBJECT_STORAGE_UNAVAILABLE',
    });
  });
});
