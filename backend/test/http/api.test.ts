// backend/test/http/api.test.ts: tests of the browser-facing HTTP API
//
// Description:
// Pins the HTTP behavior of the real NestJS application on test doubles of the
// ports: routing, the evaluation order (authentication, role, structure,
// lookup, authorization, version, state), request body rules, the session
// endpoint, the authorization matrix, the workflow, list parameters, and
// health. Responses are checked against the OpenAPI contract.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/http/api.test.ts
//
// Test Cases:
//     - Routing errors before authentication
//     - Evaluation order of failures
//     - Request body validation and normalization
//     - Session roles and the authorization matrix
//     - Workflow responses and pagination
//     - Health endpoints
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { expectContract } from '../support/contract.js';
import { createTestApp, type TestHarness } from '../support/app.js';

const MISSING = '00000000-0000-4000-8000-0000000000ff';

describe('HTTP API', () => {
  let h: TestHarness;
  beforeEach(async () => {
    h = await createTestApp();
  });
  afterAll(async () => {
    await h?.app.close();
  });

  const api = () => request(h.app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createDraft(
    token = 'tok-requester',
    body = { title: 'Laptop', description: 'Need' },
  ) {
    const res = await api().post('/api/requests').set(as(token)).send(body);
    expect(res.status).toBe(201);
    return res.body as { id: string; version: number; status: string };
  }

  describe('routing', () => {
    it('answers an unknown path with ROUTE_NOT_FOUND, before authentication', async () => {
      const res = await api().get('/api/nothing');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', status: 404 });
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('answers an unknown path outside /api with ROUTE_NOT_FOUND as a problem', async () => {
      const res = await api().get('/somewhere-else');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'ROUTE_NOT_FOUND', status: 404 });
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('answers an unsupported method on a known path with METHOD_NOT_ALLOWED', async () => {
      const res = await api().delete('/api/requests');
      expect(res.status).toBe(405);
      expect(res.body.code).toBe('METHOD_NOT_ALLOWED');
      expect(res.headers['allow']).toContain('GET');
    });

    it('returns a problem with traceId and instance, and propagates X-Request-Id', async () => {
      const res = await api().get('/api/requests').set('X-Request-Id', 'trace-1234-abcd');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        type: 'about:blank',
        title: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        traceId: 'trace-1234-abcd',
        instance: '/api/requests',
      });
      expect(res.headers['x-request-id']).toBe('trace-1234-abcd');
    });
  });

  describe('evaluation order', () => {
    it('401 wins over a malformed UUID', async () => {
      const res = await api().get('/api/requests/not-a-uuid');
      expect(res.status).toBe(401);
    });

    it('401 wins over a malformed body', async () => {
      const res = await api()
        .post('/api/requests')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(401);
    });

    it('a wrong coarse role gets 403 before the resource is looked up', async () => {
      const missing = await api().put(`/api/requests/${MISSING}`).set(as('tok-approver')).send({});
      expect(missing.status).toBe(403);
      const malformed = await api()
        .put('/api/requests/not-a-uuid')
        .set(as('tok-approver'))
        .send({});
      expect(malformed.status).toBe(403);
      const noRole = await api().get(`/api/requests/${MISSING}`).set(as('tok-norole'));
      expect(noRole.status).toBe(403);
    });

    it('validates structure after the role check: malformed UUID is 400, a missing request is 404', async () => {
      const malformed = await api().get('/api/requests/not-a-uuid').set(as('tok-requester'));
      expect(malformed.status).toBe(400);
      expect(malformed.body.code).toBe('VALIDATION_ERROR');
      const missing = await api().get(`/api/requests/${MISSING}`).set(as('tok-requester'));
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('REQUEST_NOT_FOUND');
    });

    it('an existing but inaccessible resource is 403', async () => {
      const draft = await createDraft();
      const res = await api().get(`/api/requests/${draft.id}`).set(as('tok-other'));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      const approverRes = await api().get(`/api/requests/${draft.id}`).set(as('tok-approver'));
      expect(approverRes.status).toBe(403);
    });

    it('stale version beats invalid state; matching version with invalid state is REQUEST_INVALID_STATE', async () => {
      const draft = await createDraft();
      const submit = await api()
        .post(`/api/requests/${draft.id}/submit`)
        .set(as('tok-requester'))
        .send({ version: 1 });
      expect(submit.status).toBe(200);
      const stale = await api()
        .post(`/api/requests/${draft.id}/submit`)
        .set(as('tok-requester'))
        .send({ version: 1 });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('CONCURRENCY_CONFLICT');
      const invalid = await api()
        .post(`/api/requests/${draft.id}/submit`)
        .set(as('tok-requester'))
        .send({ version: 2 });
      expect(invalid.status).toBe(409);
      expect(invalid.body.code).toBe('REQUEST_INVALID_STATE');
    });
  });

  describe('request bodies', () => {
    it('rejects malformed JSON, missing fields, unknown properties, and bad types with 400', async () => {
      const malformed = await api()
        .post('/api/requests')
        .set(as('tok-requester'))
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(malformed.status).toBe(400);
      expect(malformed.body.code).toBe('VALIDATION_ERROR');
      for (const body of [
        {},
        { title: 'x' },
        { title: 'x', description: 'y', status: 'APPROVED' },
        { title: 1, description: 'y' },
        { title: '   ', description: 'y' },
        { title: 'x'.repeat(201), description: '' },
        { title: 'x', description: 'y'.repeat(5001) },
      ]) {
        const res = await api().post('/api/requests').set(as('tok-requester')).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
    });

    it('rejects a body with an unsupported media type with 415', async () => {
      const res = await api()
        .post('/api/requests')
        .set(as('tok-requester'))
        .set('Content-Type', 'text/plain')
        .send('title=x');
      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('trims the title and normalizes line endings in the description', async () => {
      const res = await api()
        .post('/api/requests')
        .set(as('tok-requester'))
        .send({ title: '  Laptop  ', description: 'a\r\nb  ' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Laptop');
      expect(res.body.description).toBe('a\nb  ');
    });

    it('does not expose the requester email', async () => {
      const draft = await createDraft();
      const res = await api().get(`/api/requests/${draft.id}`).set(as('tok-requester'));
      expect(res.body).not.toHaveProperty('requesterEmail');
      expect(JSON.stringify(res.body)).not.toContain('requester@example.com');
    });

    it('requires a verified email to create, and maps a UserInfo outage to 503', async () => {
      const unverified = await api()
        .post('/api/requests')
        .set(as('tok-unverified'))
        .send({ title: 'x', description: '' });
      expect(unverified.status).toBe(403);
      h.identity.userInfoUnavailable = true;
      const unavailable = await api()
        .post('/api/requests')
        .set(as('tok-requester'))
        .send({ title: 'x', description: '' });
      expect(unavailable.status).toBe(503);
      expect(unavailable.body.code).toBe('IDENTITY_PROVIDER_UNAVAILABLE');
    });

    it('maps an identity provider outage during token validation to 503', async () => {
      h.identity.authenticateUnavailable = true;
      const res = await api().get('/api/session').set(as('tok-requester'));
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('IDENTITY_PROVIDER_UNAVAILABLE');
    });
  });

  describe('session', () => {
    it('returns server-derived roles in the fixed order; no-role users get an empty list', async () => {
      h.identity.register('tok-multi', { subject: 'multi', roles: ['Requester', 'Administrator'] });
      const multi = await api().get('/api/session').set(as('tok-multi'));
      expect(multi.body).toEqual({ subject: 'multi', roles: ['Requester', 'Administrator'] });
      const none = await api().get('/api/session').set(as('tok-norole'));
      expect(none.status).toBe(200);
      expect(none.body.roles).toEqual([]);
      expectContract('GET', '/api/session', none);
    });
  });

  describe('authorization matrix', () => {
    it('applies coarse roles per operation', async () => {
      const draft = await createDraft();
      const rows: Array<[string, string, string, number]> = [
        ['get', '/api/requests', 'tok-approver', 403],
        ['get', '/api/requests', 'tok-admin', 200],
        ['post', '/api/requests', 'tok-admin', 403],
        ['get', '/api/approvals', 'tok-requester', 403],
        ['get', '/api/approvals', 'tok-admin', 403],
        ['get', '/api/approvals', 'tok-approver', 200],
        ['get', '/api/admin/audit', 'tok-requester', 403],
        ['get', '/api/admin/audit', 'tok-approver', 403],
        ['get', '/api/admin/audit', 'tok-admin', 200],
        ['post', `/api/requests/${draft.id}/approve`, 'tok-requester', 403],
        ['post', `/api/requests/${draft.id}/reject`, 'tok-admin', 403],
        ['put', `/api/requests/${draft.id}`, 'tok-admin', 403],
        ['get', `/api/requests/${draft.id}/attachments`, 'tok-norole', 403],
      ];
      for (const [method, path, token, status] of rows) {
        const res = await (api() as unknown as Record<string, (p: string) => request.Test>)[
          method
        ]!(path)
          .set(as(token))
          .send({});
        expect(res.status, `${method} ${path} as ${token}`).toBe(status);
      }
    });

    it('Administrator reads any request but cannot mutate; Approver reads only SUBMITTED', async () => {
      const draft = await createDraft();
      expect((await api().get(`/api/requests/${draft.id}`).set(as('tok-admin'))).status).toBe(200);
      expect((await api().get(`/api/requests/${draft.id}`).set(as('tok-approver'))).status).toBe(
        403,
      );
      await api()
        .post(`/api/requests/${draft.id}/submit`)
        .set(as('tok-requester'))
        .send({ version: 1 });
      expect((await api().get(`/api/requests/${draft.id}`).set(as('tok-approver'))).status).toBe(
        200,
      );
    });
  });

  describe('workflow and lists', () => {
    it('runs create, update, submit, approve with documented responses', async () => {
      const created = await api()
        .post('/api/requests')
        .set(as('tok-requester'))
        .send({ title: 'T', description: 'D' });
      expectContract('POST', '/api/requests', created);
      const id = created.body.id as string;
      const updated = await api()
        .put(`/api/requests/${id}`)
        .set(as('tok-requester'))
        .send({ title: 'T2', description: 'D2', version: 1 });
      expect(updated.status).toBe(200);
      expectContract('PUT', '/api/requests/{requestId}', updated);
      const submitted = await api()
        .post(`/api/requests/${id}/submit`)
        .set(as('tok-requester'))
        .send({ version: 2 });
      expectContract('POST', '/api/requests/{requestId}/submit', submitted);
      const queue = await api().get('/api/approvals').set(as('tok-approver'));
      expectContract('GET', '/api/approvals', queue);
      expect(queue.body.items.map((r: { id: string }) => r.id)).toEqual([id]);
      const approved = await api()
        .post(`/api/requests/${id}/approve`)
        .set(as('tok-approver'))
        .send({ version: 3, comment: '  fine  ' });
      expect(approved.status).toBe(200);
      expect(approved.body.status).toBe('APPROVED');
      expectContract('POST', '/api/requests/{requestId}/approve', approved);
      const audit = await api()
        .get('/api/admin/audit')
        .query({ requestId: id })
        .set(as('tok-admin'));
      expectContract('GET', '/api/admin/audit', audit);
      expect(audit.body.items.map((e: { eventType: string }) => e.eventType)).toContain(
        'REQUEST_APPROVED',
      );
      const list = await api().get('/api/requests').set(as('tok-requester'));
      expectContract('GET', '/api/requests', list);
      const problem = await api()
        .post(`/api/requests/${id}/approve`)
        .set(as('tok-approver'))
        .send({ version: 4 });
      expect(problem.status).toBe(409);
      expectContract('POST', '/api/requests/{requestId}/approve', problem);
    });

    it('validates list parameters and paginates with an opaque cursor', async () => {
      for (const query of [
        'limit=0',
        'limit=101',
        'limit=abc',
        'limit=1&limit=2',
        'cursor=',
        'cursor=garbage',
      ]) {
        const res = await api().get(`/api/requests?${query}`).set(as('tok-requester'));
        expect(res.status, query).toBe(400);
      }
      for (let i = 0; i < 3; i += 1) {
        h.clock.advance(1000);
        await createDraft('tok-requester', { title: `R${i}`, description: '' });
      }
      const first = await api().get('/api/requests?limit=2').set(as('tok-requester'));
      expect(first.body.items).toHaveLength(2);
      expect(typeof first.body.nextCursor).toBe('string');
      const second = await api()
        .get('/api/requests')
        .query({ limit: 2, cursor: first.body.nextCursor })
        .set(as('tok-requester'));
      expect(second.body.items).toHaveLength(1);
      expect(second.body).not.toHaveProperty('nextCursor');
      const wrongEndpoint = await api()
        .get('/api/admin/audit')
        .query({ cursor: first.body.nextCursor })
        .set(as('tok-admin'));
      expect(wrongEndpoint.status).toBe(400);
    });

    it('validates the audit filter', async () => {
      const res = await api().get('/api/admin/audit?requestId=nope').set(as('tok-admin'));
      expect(res.status).toBe(400);
    });
  });

  describe('health', () => {
    it('reports readiness and never exposes details', async () => {
      const ok = await api().get('/health/ready');
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ status: 'ok' });
      h.ready.value = false;
      const notReady = await api().get('/health/ready');
      expect(notReady.status).toBe(503);
      expect(notReady.body).toEqual({ status: 'not_ready' });
    });
  });
});
