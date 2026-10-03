// backend/src/capabilities/shared/ports.ts: persistence and object storage ports
//
// Description:
// Defines the record types and the repository, transaction, and object-storage
// ports used by the capability services.
//
// The ports are defined by application need and carry no database client or
// AWS SDK type. Repositories return up to the requested limit, and callers
// pass limit + 1 to detect another page.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import type { Keyset } from '../../common/cursor.js';
import type { RequestRecord, RequestStatus } from '../requests/domain/request.js';

export interface ApprovalRecord {
  id: string;
  requestId: string;
  approverId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment: string | null;
  decidedAt: Date;
}

export interface AttachmentRecord {
  id: string;
  requestId: string;
  objectKey: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: Date;
}

export type AuditEventType =
  | 'REQUEST_CREATED'
  | 'REQUEST_UPDATED'
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'ATTACHMENT_ADDED';

export interface AuditRecord {
  id: string;
  requestId: string;
  eventType: AuditEventType;
  actorId: string;
  fromState: RequestStatus | null;
  toState: RequestStatus | null;
  details: Record<string, unknown> | null;
  occurredAt: Date;
}

export type OutboxEventType = 'REQUEST_SUBMITTED' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED';
export type OutboxChannel = 'EMAIL' | 'EVENT';
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';

export interface OutboxRow {
  id: string;
  aggregateId: string;
  eventType: OutboxEventType;
  channel: OutboxChannel;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  createdAt: Date;
}

/** Repository methods return up to `limit` rows; callers pass limit+1 to detect another page. */
export interface RequestRepository {
  findById(id: string): Promise<RequestRecord | null>;
  insert(request: RequestRecord): Promise<void>;
  update(request: RequestRecord): Promise<void>;
  /** Order: updatedAt desc, id asc. `ownerId` undefined means all requests. */
  list(query: { ownerId?: string; after?: Keyset; limit: number }): Promise<RequestRecord[]>;
  /** SUBMITTED requests, order: updatedAt asc, id asc. */
  listSubmitted(query: { after?: Keyset; limit: number }): Promise<RequestRecord[]>;
}

export interface ApprovalRepository {
  insert(approval: ApprovalRecord): Promise<void>;
}

export interface AttachmentRepository {
  insert(attachment: AttachmentRecord): Promise<void>;
  findById(id: string): Promise<AttachmentRecord | null>;
  /** Order: createdAt asc, id asc. */
  listByRequest(query: {
    requestId: string;
    after?: Keyset;
    limit: number;
  }): Promise<AttachmentRecord[]>;
}

export interface AuditRepository {
  insert(event: AuditRecord): Promise<void>;
  /** Order: occurredAt desc, id asc. */
  list(query: { requestId?: string; after?: Keyset; limit: number }): Promise<AuditRecord[]>;
}

export interface OutboxWriter {
  insertMany(rows: OutboxRow[]): Promise<void>;
}

export interface Repositories {
  requests: RequestRepository;
  approvals: ApprovalRepository;
  attachments: AttachmentRepository;
  audit: AuditRepository;
  outbox: OutboxWriter;
}

export interface TransactionRepositories extends Repositories {
  /** Loads the request row with a row lock (SELECT ... FOR UPDATE). */
  lockRequest(id: string): Promise<RequestRecord | null>;
}

export interface Persistence {
  readonly repositories: Repositories;
  /** Runs `work` in one local database transaction (READ COMMITTED). */
  transaction<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T>;
}

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: NodeJS.ReadableStream; contentLength: number | undefined }>;
  delete(key: string): Promise<void>;
}
