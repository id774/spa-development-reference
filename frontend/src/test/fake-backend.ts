// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ApiRequest, Attachment, AuditEvent, SessionRole } from '@spa-ref/api-client';

const TOKEN_ENDPOINT = 'https://auth.example.com/oauth2/token';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function problem(status: number, code: string, title: string): Response {
  return json({ title, status, code, traceId: 'trace-test' }, status);
}

/** An in-memory stand-in for the BFF and the identity provider token endpoint. */
export class FakeBackend {
  subject = 'user-1';
  roles: SessionRole[] = ['Requester'];
  requests: ApiRequest[] = [];
  attachments = new Map<string, Attachment[]>();
  audit: AuditEvent[] = [];
  calls: string[] = [];
  tokenGrants: URLSearchParams[] = [];
  validTokens = new Set<string>();
  /** Roles issued with the next refreshed token. */
  rolesAfterRefresh: SessionRole[] | null = null;
  expiresInSeconds = 3600;
  failRefresh = false;
  private tokenCounter = 0;
  private idCounter = 0;

  nextId(): string {
    this.idCounter += 1;
    return `00000000-0000-4000-8000-${String(this.idCounter).padStart(12, '0')}`;
  }

  seedRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
    const now = '2026-01-01T00:00:00.000Z';
    const request: ApiRequest = {
      id: this.nextId(),
      requesterId: this.subject,
      title: 'Seeded request',
      description: 'Seeded description',
      status: 'DRAFT',
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    this.requests.push(request);
    return request;
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://app.test');
    const method = (init.method ?? 'GET').toUpperCase();
    this.calls.push(`${method} ${url.pathname}`);

    if (url.href === TOKEN_ENDPOINT) return this.token(init);

    const authorization = new Headers(init.headers).get('Authorization');
    if (!authorization || !this.validTokens.has(authorization.replace('Bearer ', ''))) {
      return problem(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }
    const path = url.pathname;

    if (path === '/api/session') return json({ subject: this.subject, roles: this.roles });
    if (path === '/api/requests' && method === 'GET') {
      const own = this.requests.filter(
        (r) => r.requesterId === this.subject || this.roles.includes('Administrator'),
      );
      return json({ items: own });
    }
    if (path === '/api/requests' && method === 'POST') {
      const body = JSON.parse(String(init.body)) as { title: string; description: string };
      const created = this.seedRequest({ title: body.title, description: body.description });
      return json(created, 201);
    }
    if (path === '/api/approvals')
      return json({ items: this.requests.filter((r) => r.status === 'SUBMITTED') });
    if (path === '/api/admin/audit') return json({ items: this.audit });

    const match = /^\/api\/requests\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/.exec(path);
    if (match) {
      const [, id, action, attachmentId] = match;
      const request = this.requests.find((r) => r.id === id);
      if (!request) return problem(404, 'REQUEST_NOT_FOUND', 'Request not found');
      if (action === undefined && method === 'GET') return json(request);
      if (action === undefined && method === 'PUT') {
        const body = JSON.parse(String(init.body)) as {
          title: string;
          description: string;
          version: number;
        };
        Object.assign(request, {
          title: body.title,
          description: body.description,
          version: request.version + 1,
        });
        return json(request);
      }
      if (action === 'submit' || action === 'approve' || action === 'reject') {
        const next = { submit: 'SUBMITTED', approve: 'APPROVED', reject: 'REJECTED' } as const;
        Object.assign(request, { status: next[action], version: request.version + 1 });
        return json(request);
      }
      if (action === 'attachments' && attachmentId === undefined && method === 'GET') {
        return json({ items: this.attachments.get(request.id) ?? [] });
      }
      if (action === 'attachments' && attachmentId === undefined && method === 'POST') {
        const file = (init.body as FormData).get('file') as File;
        const attachment: Attachment = {
          id: this.nextId(),
          requestId: request.id,
          fileName: file.name,
          mediaType: file.type,
          sizeBytes: file.size,
          uploadedBy: this.subject,
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        this.attachments.set(request.id, [...(this.attachments.get(request.id) ?? []), attachment]);
        return json(attachment, 201);
      }
      if (action === 'attachments' && attachmentId !== undefined) {
        return new Response('content', {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        });
      }
    }
    return problem(404, 'ROUTE_NOT_FOUND', 'Route not found');
  };

  private async token(init: RequestInit): Promise<Response> {
    const params = new URLSearchParams(String(init.body));
    this.tokenGrants.push(params);
    if (params.get('grant_type') === 'refresh_token') {
      if (this.failRefresh) return json({ error: 'invalid_grant' }, 400);
      if (this.rolesAfterRefresh) this.roles = this.rolesAfterRefresh;
    } else if (params.get('code') === 'bad') {
      return json({ error: 'invalid_grant' }, 400);
    }
    this.tokenCounter += 1;
    const access = `access-${this.tokenCounter}`;
    this.validTokens.add(access);
    return json({
      access_token: access,
      refresh_token: 'refresh-1',
      expires_in: this.expiresInSeconds,
    });
  }

  invalidateAllTokens(): void {
    this.validTokens.clear();
  }
}
