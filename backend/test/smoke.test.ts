// License: The GPL version 3, or LGPL version 3 (Dual License).
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestHarness } from './support/app.js';

describe('smoke', () => {
  let h: TestHarness;
  beforeAll(async () => {
    h = await createTestApp();
  });
  afterAll(async () => {
    await h.app.close();
  });

  it('serves liveness without authentication', async () => {
    const res = await request(h.app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('requires authentication for the session', async () => {
    const res = await request(h.app.getHttpServer()).get('/api/session');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns the session roles', async () => {
    const res = await request(h.app.getHttpServer())
      .get('/api/session')
      .set('Authorization', 'Bearer tok-requester');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subject: 'user-requester', roles: ['Requester'] });
  });
});
