// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { RequestRecord } from '../../capabilities/requests/domain/request.js';
import type { AttachmentRecord, AuditRecord } from '../../capabilities/shared/ports.js';

/** Browser-facing representations. `requesterEmail` and `objectKey` are never exposed. */
export function toRequestDto(request: RequestRecord) {
  return {
    id: request.id,
    requesterId: request.requesterId,
    title: request.title,
    description: request.description,
    status: request.status,
    version: request.version,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

export function toAttachmentDto(attachment: AttachmentRecord) {
  return {
    id: attachment.id,
    requestId: attachment.requestId,
    fileName: attachment.fileName,
    mediaType: attachment.mediaType,
    sizeBytes: attachment.sizeBytes,
    uploadedBy: attachment.uploadedBy,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function toAuditDto(event: AuditRecord) {
  return {
    id: event.id,
    requestId: event.requestId,
    eventType: event.eventType,
    actorId: event.actorId,
    fromState: event.fromState,
    toState: event.toState,
    details: event.details,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export function listBody<T, U>(page: { items: T[]; nextCursor?: string }, map: (item: T) => U) {
  return {
    items: page.items.map(map),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}
