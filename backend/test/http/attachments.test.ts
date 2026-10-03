// License: The GPL version 3, or LGPL version 3 (Dual License).
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestHarness } from '../support/app.js';
import { expectContract } from '../support/contract.js';

const PDF = Buffer.from('%PDF-1.4 hello');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('x'),
]);

describe('attachment HTTP behavior', () => {
  let h: TestHarness;
  let requestId: string;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = () => request(h.app.getHttpServer());

  beforeEach(async () => {
    h = await createTestApp(undefined, { maxBytes: 64 });
    const created = await api()
      .post('/api/requests')
      .set(as('tok-requester'))
      .send({ title: 'T', description: '' });
    requestId = created.body.id as string;
  });
  afterEach(async () => {
    await h.app.close();
  });

  const upload = (
    token: string,
    file: Buffer,
    filename: string,
    contentType: string,
    id = requestId,
  ) =>
    api()
      .post(`/api/requests/${id}/attachments`)
      .set(as(token))
      .attach('file', file, { filename, contentType });

  it('uploads, lists, and downloads with safe headers (rediscovery without the upload response)', async () => {
    const res = await upload('tok-requester', PDF, 'doc.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expectContract('POST', '/api/requests/{requestId}/attachments', res);
    expect(res.body).toMatchObject({
      fileName: 'doc.pdf',
      mediaType: 'application/pdf',
      sizeBytes: PDF.length,
    });
    expect(res.body).not.toHaveProperty('objectKey');

    // Rediscover from the list endpoint alone, as the SPA does after a reload.
    const list = await api().get(`/api/requests/${requestId}/attachments`).set(as('tok-requester'));
    expect(list.status).toBe(200);
    expectContract('GET', '/api/requests/{requestId}/attachments', list);
    const [attachment] = list.body.items as Array<{ id: string }>;
    expect(attachment?.id).toBe(res.body.id);

    const download = await api()
      .get(`/api/requests/${requestId}/attachments/${attachment?.id}`)
      .set(as('tok-requester'))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-length']).toBe(String(PDF.length));
    expect(download.headers['content-disposition']).toMatch(
      /^attachment; filename="doc\.pdf"; filename\*=UTF-8''doc\.pdf$/,
    );
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects invalid uploads with the documented statuses', async () => {
    const cases: Array<[string, Buffer, string, string, number, string]> = [
      ['unsupported type', PDF, 'a.zip', 'application/zip', 415, 'UNSUPPORTED_MEDIA_TYPE'],
      ['signature mismatch', PNG, 'a.pdf', 'application/pdf', 415, 'UNSUPPORTED_MEDIA_TYPE'],
      ['extension mismatch', PDF, 'a.png', 'application/pdf', 415, 'UNSUPPORTED_MEDIA_TYPE'],
      ['zero-byte', Buffer.alloc(0), 'a.pdf', 'application/pdf', 400, 'VALIDATION_ERROR'],
      ['control character in name', PDF, 'a\u0007.pdf', 'application/pdf', 400, 'VALIDATION_ERROR'],
      [
        'too large',
        Buffer.concat([PDF, Buffer.alloc(100)]),
        'a.pdf',
        'application/pdf',
        413,
        'PAYLOAD_TOO_LARGE',
      ],
    ];
    for (const [label, file, name, type, status, code] of cases) {
      const res = await upload('tok-requester', file, name, type);
      expect(res.status, label).toBe(status);
      expect(res.body.code, label).toBe(code);
      expectContract('POST', '/api/requests/{requestId}/attachments', res);
    }
    expect(h.storage.objects.size).toBe(0);
  });

  it('requires multipart/form-data and a file part', async () => {
    const json = await api()
      .post(`/api/requests/${requestId}/attachments`)
      .set(as('tok-requester'))
      .send({ a: 1 });
    expect(json.status).toBe(415);
    const noFile = await api()
      .post(`/api/requests/${requestId}/attachments`)
      .set(as('tok-requester'))
      .field('x', 'y');
    expect(noFile.status).toBe(400);
  });

  it('enforces role, ownership, and state; unauthenticated callers get 401 first', async () => {
    expect((await upload('tok-approver', PDF, 'a.pdf', 'application/pdf')).status).toBe(403);
    expect((await upload('tok-other', PDF, 'a.pdf', 'application/pdf')).status).toBe(403);
    const unauthenticated = await api()
      .post(`/api/requests/${requestId}/attachments`)
      .attach('file', PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(unauthenticated.status).toBe(401);
    await api()
      .post(`/api/requests/${requestId}/submit`)
      .set(as('tok-requester'))
      .send({ version: 1 });
    const late = await upload('tok-requester', PDF, 'a.pdf', 'application/pdf');
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('REQUEST_INVALID_STATE');
    const missing = await upload(
      'tok-requester',
      PDF,
      'a.pdf',
      'application/pdf',
      '00000000-0000-4000-8000-0000000000ff',
    );
    expect(missing.status).toBe(404);
  });

  it('maps object storage failures to 503', async () => {
    h.storage.failPut = true;
    const res = await upload('tok-requester', PDF, 'a.pdf', 'application/pdf');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('OBJECT_STORAGE_UNAVAILABLE');
    expectContract('POST', '/api/requests/{requestId}/attachments', res);
  });

  it('applies download visibility and path consistency', async () => {
    const uploaded = await upload('tok-requester', PDF, 'a.pdf', 'application/pdf');
    const id = uploaded.body.id as string;
    const path = `/api/requests/${requestId}/attachments/${id}`;
    expect((await api().get(path).set(as('tok-approver'))).status).toBe(403);
    expect((await api().get(path).set(as('tok-other'))).status).toBe(403);
    expect((await api().get(path).set(as('tok-admin'))).status).toBe(200);
    await api()
      .post(`/api/requests/${requestId}/submit`)
      .set(as('tok-requester'))
      .send({ version: 1 });
    expect((await api().get(path).set(as('tok-approver'))).status).toBe(200);
    expect(
      (await api().get(`/api/requests/${requestId}/attachments`).set(as('tok-approver'))).status,
    ).toBe(200);

    const other = await api()
      .post('/api/requests')
      .set(as('tok-requester'))
      .send({ title: 'O', description: '' });
    const mismatch = await api()
      .get(`/api/requests/${other.body.id}/attachments/${id}`)
      .set(as('tok-requester'));
    expect(mismatch.status).toBe(404);
    expect(mismatch.body.code).toBe('ATTACHMENT_NOT_FOUND');
    expect(
      (
        await api()
          .get(`/api/requests/${requestId}/attachments/not-a-uuid`)
          .set(as('tok-requester'))
      ).status,
    ).toBe(400);
  });

  it('lists with pagination bound to the request', async () => {
    for (const name of ['a.pdf', 'b.pdf']) {
      h.clock.advance(1000);
      await upload('tok-requester', PDF, name, 'application/pdf');
    }
    const first = await api()
      .get(`/api/requests/${requestId}/attachments?limit=1`)
      .set(as('tok-requester'));
    expect(first.body.items.map((a: { fileName: string }) => a.fileName)).toEqual(['a.pdf']);
    const second = await api()
      .get(`/api/requests/${requestId}/attachments`)
      .query({ limit: 1, cursor: first.body.nextCursor })
      .set(as('tok-requester'));
    expect(second.body.items.map((a: { fileName: string }) => a.fileName)).toEqual(['b.pdf']);
    const other = await api()
      .post('/api/requests')
      .set(as('tok-requester'))
      .send({ title: 'O', description: '' });
    const wrong = await api()
      .get(`/api/requests/${other.body.id}/attachments`)
      .query({ cursor: first.body.nextCursor })
      .set(as('tok-requester'));
    expect(wrong.status).toBe(400);
  });
});
