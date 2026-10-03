// License: The GPL version 3, or LGPL version 3 (Dual License).
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
