// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { components } from './generated/schema.js';

export type { components, paths } from './generated/schema.js';

type Schemas = components['schemas'];
export type Session = Schemas['Session'];
export type SessionRole = Schemas['SessionRole'];
export type ApiRequest = Schemas['Request'];
export type RequestList = Schemas['RequestList'];
export type RequestStatus = Schemas['RequestStatus'];
export type CreateRequestInput = Schemas['CreateRequestInput'];
export type UpdateDraftRequestInput = Schemas['UpdateDraftRequestInput'];
export type VersionCommand = Schemas['VersionCommand'];
export type DecisionCommand = Schemas['DecisionCommand'];
export type Attachment = Schemas['Attachment'];
export type AttachmentList = Schemas['AttachmentList'];
export type AuditEvent = Schemas['AuditEvent'];
export type AuditEventList = Schemas['AuditEventList'];
export type AuditEventType = Schemas['AuditEventType'];
export type Problem = Schemas['Problem'];
export type ErrorCode = Schemas['ErrorCode'];

export interface ListParams {
  limit?: number;
  cursor?: string;
}

export interface DownloadedAttachment {
  blob: Blob;
  fileName: string;
  mediaType: string;
}

/** Error thrown for every non-2xx response. `problem` is set when the body is a Problem. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;

  constructor(status: number, problem: Problem | null) {
    super(problem?.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  get code(): ErrorCode | null {
    return this.problem?.code ?? null;
  }
}

export interface ApiClientOptions {
  /** Base URL without trailing slash. Defaults to same origin (empty string). */
  baseUrl?: string;
  /** Returns the current access token, refreshing it when needed. */
  getAccessToken: () => Promise<string | null>;
  /** Called after the server answered 401 AUTHENTICATION_REQUIRED. */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

export interface ApiClient {
  getSession(): Promise<Session>;
  listRequests(params?: ListParams): Promise<RequestList>;
  createRequest(input: CreateRequestInput): Promise<ApiRequest>;
  getRequest(requestId: string): Promise<ApiRequest>;
  updateDraftRequest(requestId: string, input: UpdateDraftRequestInput): Promise<ApiRequest>;
  submitRequest(requestId: string, input: VersionCommand): Promise<ApiRequest>;
  approveRequest(requestId: string, input: DecisionCommand): Promise<ApiRequest>;
  rejectRequest(requestId: string, input: DecisionCommand): Promise<ApiRequest>;
  listApprovals(params?: ListParams): Promise<RequestList>;
  listAttachments(requestId: string, params?: ListParams): Promise<AttachmentList>;
  uploadAttachment(requestId: string, file: File): Promise<Attachment>;
  downloadAttachment(requestId: string, attachment: Attachment): Promise<DownloadedAttachment>;
  listAuditEvents(params?: ListParams & { requestId?: string }): Promise<AuditEventList>;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text === '' ? '' : `?${text}`;
}

async function readProblem(response: Response): Promise<Problem | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'code' in body && 'traceId' in body) {
      return body as Problem;
    }
  } catch {
    // The body is not JSON; the caller reports the bare status.
  }
  return null;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await options.getAccessToken();
    const headers = new Headers(init.headers);
    if (token !== null) headers.set('Authorization', `Bearer ${token}`);
    const response = await doFetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const problem = await readProblem(response);
      if (response.status === 401 && problem?.code === 'AUTHENTICATION_REQUIRED') {
        options.onUnauthorized?.();
      }
      throw new ApiError(response.status, problem);
    }
    return response;
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await send(path, init);
    return (await response.json()) as T;
  }

  function jsonBody(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  const id = encodeURIComponent;

  return {
    getSession: () => json('/api/session'),
    listRequests: (params = {}) => json(`/api/requests${query({ ...params })}`),
    createRequest: (input) => json('/api/requests', jsonBody('POST', input)),
    getRequest: (requestId) => json(`/api/requests/${id(requestId)}`),
    updateDraftRequest: (requestId, input) =>
      json(`/api/requests/${id(requestId)}`, jsonBody('PUT', input)),
    submitRequest: (requestId, input) =>
      json(`/api/requests/${id(requestId)}/submit`, jsonBody('POST', input)),
    approveRequest: (requestId, input) =>
      json(`/api/requests/${id(requestId)}/approve`, jsonBody('POST', input)),
    rejectRequest: (requestId, input) =>
      json(`/api/requests/${id(requestId)}/reject`, jsonBody('POST', input)),
    listApprovals: (params = {}) => json(`/api/approvals${query({ ...params })}`),
    listAttachments: (requestId, params = {}) =>
      json(`/api/requests/${id(requestId)}/attachments${query({ ...params })}`),
    uploadAttachment: (requestId, file) => {
      const form = new FormData();
      form.append('file', file, file.name);
      return json(`/api/requests/${id(requestId)}/attachments`, { method: 'POST', body: form });
    },
    downloadAttachment: async (requestId, attachment) => {
      const response = await send(
        `/api/requests/${id(requestId)}/attachments/${id(attachment.id)}`,
      );
      return {
        blob: await response.blob(),
        fileName: attachment.fileName,
        mediaType: attachment.mediaType,
      };
    },
    listAuditEvents: (params = {}) => json(`/api/admin/audit${query({ ...params })}`),
  };
}
