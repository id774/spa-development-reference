// packages/api-client/src/index.test.ts: tests of the API client
//
// Description:
// Pins the API client with a fake fetch: the bearer token and JSON parsing,
// list query construction, ApiError with the Problem body and the 401
// notification, and the absence of that notification for other errors.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole API client suite:
//         npm run test -w @spa-ref/api-client
//
//     Run this file:
//         npm run test -w @spa-ref/api-client -- src/index.test.ts
//
// Test Cases:
//     - Bearer token and JSON parsing
//     - List queries from limit and cursor
//     - ApiError with problem details and 401 notification
//     - No notification for other errors
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See packages/api-client/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './index.js';

function respond(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    const fetchMock = vi.fn(async () => respond(200, { subject: 's', roles: ['Requester'] }));
    const client = createApiClient({ getAccessToken: async () => 'tok', fetch: fetchMock });
    const session = await client.getSession();
    expect(session.roles).toEqual(['Requester']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/session');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('builds list queries from limit and cursor', async () => {
    const fetchMock = vi.fn(async () => respond(200, { items: [] }));
    const client = createApiClient({ getAccessToken: async () => 'tok', fetch: fetchMock });
    await client.listRequests({ limit: 10, cursor: 'abc' });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      '/api/requests?limit=10&cursor=abc',
    );
  });

  it('throws ApiError with the problem and notifies on 401', async () => {
    const problem = {
      title: 'Authentication required',
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      traceId: 't',
    };
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      getAccessToken: async () => 'tok',
      onUnauthorized,
      fetch: async () => respond(401, problem, 'application/problem+json'),
    });
    const error = await client.getSession().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('AUTHENTICATION_REQUIRED');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not notify on other errors', async () => {
    const problem = { title: 'Forbidden', status: 403, code: 'FORBIDDEN', traceId: 't' };
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      getAccessToken: async () => 'tok',
      onUnauthorized,
      fetch: async () => respond(403, problem, 'application/problem+json'),
    });
    await expect(client.listApprovals()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
