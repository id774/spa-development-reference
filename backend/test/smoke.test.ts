// backend/test/smoke.test.ts: smoke test of the HTTP application
//
// Description:
// A minimal check that the application starts on test doubles: liveness is
// public, the session requires authentication, and an authenticated caller
// receives its roles.
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
//         npm run test -w @spa-ref/backend -- test/smoke.test.ts
//
// Test Cases:
//     - Public liveness
//     - Authentication required for the session
//     - Session roles
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
