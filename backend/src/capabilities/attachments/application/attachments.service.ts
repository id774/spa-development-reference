// backend/src/capabilities/attachments/application/attachments.service.ts: attachments capability service
//
// Description:
// Implements listing, uploading, and downloading attachments. Upload is
// limited to the owning Requester of a DRAFT request, and the state is checked
// before the object transfer and again, under a row lock, when the metadata
// and audit event are committed.
//
// If the metadata transaction fails after the object was written, the orphan
// object is deleted on a best-effort basis. Storage failures become
// OBJECT_STORAGE_UNAVAILABLE without exposing provider details.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
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

import { AppError } from '../../../common/errors.js';
import {
  buildPage,
  decodeCursor,
  type ListInput,
  type PageResult,
} from '../../../common/cursor.js';
import { describeError, type AppLogger } from '../../../common/logging.js';
import type { Clock, IdGenerator } from '../../../common/ports.js';
import { canViewRequest, isOwner } from '../../requests/domain/request.js';
import { hasRole, type Identity } from '../../shared/identity.js';
import type { AttachmentRecord, ObjectStorage, Persistence } from '../../shared/ports.js';
import { recordAudit } from '../../shared/recording.js';
import type { ValidUpload } from '../domain/attachment-rules.js';

export class AttachmentsService {
  constructor(
    private readonly persistence: Persistence,
    private readonly storage: ObjectStorage,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: AppLogger,
  ) {}

  /** Same visibility as download, applied to the addressed request. */
  async list(
    identity: Identity,
    requestId: string,
    input: ListInput,
  ): Promise<PageResult<AttachmentRecord>> {
    const request = await this.persistence.repositories.requests.findById(requestId);
    if (request === null) throw new AppError('REQUEST_NOT_FOUND');
    if (!canViewRequest(identity, request)) throw new AppError('FORBIDDEN');
    const after = input.cursor ? decodeCursor(input.cursor, 'attachments', requestId) : undefined;
    const rows = await this.persistence.repositories.attachments.listByRequest({
      requestId,
      ...(after ? { after } : {}),
      limit: input.limit + 1,
    });
    return buildPage(
      rows,
      input.limit,
      (a) => ({ at: a.createdAt, id: a.id }),
      'attachments',
      requestId,
    );
  }

  /**
   * Requester + ownership + DRAFT. The state is checked before the S3 transfer
   * and again, under a row lock, when the metadata and audit event are written.
   */
  async upload(
    identity: Identity,
    requestId: string,
    upload: ValidUpload,
  ): Promise<AttachmentRecord> {
    if (!hasRole(identity, 'Requester')) throw new AppError('FORBIDDEN');
    const request = await this.persistence.repositories.requests.findById(requestId);
    if (request === null) throw new AppError('REQUEST_NOT_FOUND');
    if (!isOwner(identity, request)) throw new AppError('FORBIDDEN');
    if (request.status !== 'DRAFT') throw new AppError('REQUEST_INVALID_STATE');

    const attachmentId = this.ids.uuid();
    const objectKey = `attachments/${requestId}/${attachmentId}`;
    try {
      await this.storage.put(objectKey, upload.bytes, upload.mediaType);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('object storage write failed', { error: describeError(error) });
      throw new AppError('OBJECT_STORAGE_UNAVAILABLE', undefined, { cause: error });
    }

    const now = this.clock.now();
    const attachment: AttachmentRecord = {
      id: attachmentId,
      requestId,
      objectKey,
      fileName: upload.fileName,
      mediaType: upload.mediaType,
      sizeBytes: upload.bytes.length,
      uploadedBy: identity.subject,
      createdAt: now,
    };
    try {
      await this.persistence.transaction(async (tx) => {
        const current = await tx.lockRequest(requestId);
        if (current === null) throw new AppError('REQUEST_NOT_FOUND');
        if (!isOwner(identity, current)) throw new AppError('FORBIDDEN');
        if (current.status !== 'DRAFT') throw new AppError('REQUEST_INVALID_STATE');
        await tx.attachments.insert(attachment);
        await recordAudit(tx, this.ids, {
          requestId,
          eventType: 'ATTACHMENT_ADDED',
          actorId: identity.subject,
          fromState: current.status,
          toState: current.status,
          details: { attachmentId },
          at: now,
        });
      });
    } catch (error) {
      await this.cleanUpOrphan(objectKey);
      throw error;
    }
    return attachment;
  }

  async download(identity: Identity, requestId: string, attachmentId: string) {
    const request = await this.persistence.repositories.requests.findById(requestId);
    if (request === null) throw new AppError('REQUEST_NOT_FOUND');
    if (!canViewRequest(identity, request)) throw new AppError('FORBIDDEN');
    const attachment = await this.persistence.repositories.attachments.findById(attachmentId);
    if (attachment === null || attachment.requestId !== requestId) {
      throw new AppError('ATTACHMENT_NOT_FOUND');
    }
    try {
      const object = await this.storage.get(attachment.objectKey);
      return { attachment, body: object.body };
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('object storage read failed', { error: describeError(error) });
      throw new AppError('OBJECT_STORAGE_UNAVAILABLE', undefined, { cause: error });
    }
  }

  /** Best-effort deletion of an object whose metadata was not committed. */
  private async cleanUpOrphan(objectKey: string): Promise<void> {
    try {
      await this.storage.delete(objectKey);
    } catch (error) {
      this.logger.error('orphan object could not be deleted', {
        objectKey,
        error: describeError(error),
      });
    }
  }
}
