// backend/src/capabilities/requests/application/requests.service.ts: requests capability service
//
// Description:
// Implements listing, reading, creating, updating, and submitting requests.
// Every state change runs in one local transaction under a row lock: load,
// ownership, version, then state.
//
// The audit event is committed in the same transaction as the state change,
// and submitting also records the email and event outbox rows. Role checks are
// repeated here because the service is the authorization boundary for the
// capability.
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

import { AppError } from '../../../common/errors.js';
import {
  buildPage,
  decodeCursor,
  type ListInput,
  type PageResult,
} from '../../../common/cursor.js';
import type { Clock, IdGenerator } from '../../../common/ports.js';
import { hasRole, type Identity } from '../../shared/identity.js';
import type { Persistence } from '../../shared/ports.js';
import { recordAudit, recordNotifications } from '../../shared/recording.js';
import {
  applyOperation,
  canApply,
  canViewRequest,
  isOwner,
  type Operation,
  type RequestRecord,
} from '../domain/request.js';

export interface DraftContent {
  title: string;
  description: string;
}

export class RequestsService {
  constructor(
    private readonly persistence: Persistence,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Requester: own requests. Administrator: all requests. Union for both roles. */
  async list(identity: Identity, input: ListInput): Promise<PageResult<RequestRecord>> {
    if (!hasRole(identity, 'Requester', 'Administrator')) throw new AppError('FORBIDDEN');
    const after = input.cursor ? decodeCursor(input.cursor, 'requests', '') : undefined;
    const ownerId = hasRole(identity, 'Administrator') ? undefined : identity.subject;
    const rows = await this.persistence.repositories.requests.list({
      ...(ownerId === undefined ? {} : { ownerId }),
      ...(after ? { after } : {}),
      limit: input.limit + 1,
    });
    return buildPage(rows, input.limit, (r) => ({ at: r.updatedAt, id: r.id }), 'requests', '');
  }

  async get(identity: Identity, requestId: string): Promise<RequestRecord> {
    const request = await this.persistence.repositories.requests.findById(requestId);
    if (request === null) throw new AppError('REQUEST_NOT_FOUND');
    if (!canViewRequest(identity, request)) throw new AppError('FORBIDDEN');
    return request;
  }

  /** Creates a DRAFT request. `verifiedEmail` is captured for later notifications. */
  async create(
    identity: Identity,
    content: DraftContent,
    verifiedEmail: string,
  ): Promise<RequestRecord> {
    if (!hasRole(identity, 'Requester')) throw new AppError('FORBIDDEN');
    const now = this.clock.now();
    const request: RequestRecord = {
      id: this.ids.uuid(),
      requesterId: identity.subject,
      requesterEmail: verifiedEmail,
      title: content.title,
      description: content.description,
      status: 'DRAFT',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.persistence.transaction(async (tx) => {
      await tx.requests.insert(request);
      await recordAudit(tx, this.ids, {
        requestId: request.id,
        eventType: 'REQUEST_CREATED',
        actorId: identity.subject,
        fromState: null,
        toState: 'DRAFT',
        at: now,
      });
    });
    return request;
  }

  async updateDraft(
    identity: Identity,
    requestId: string,
    content: DraftContent & { version: number },
  ): Promise<RequestRecord> {
    return this.ownerTransition(identity, requestId, 'update', content.version, content);
  }

  async submit(identity: Identity, requestId: string, version: number): Promise<RequestRecord> {
    return this.ownerTransition(identity, requestId, 'submit', version);
  }

  /**
   * Requester-owned transition. Evaluation order inside the locked
   * transaction: load, ownership, version, state.
   */
  private async ownerTransition(
    identity: Identity,
    requestId: string,
    operation: Extract<Operation, 'update' | 'submit'>,
    expectedVersion: number,
    content?: DraftContent,
  ): Promise<RequestRecord> {
    if (!hasRole(identity, 'Requester')) throw new AppError('FORBIDDEN');
    const now = this.clock.now();
    return this.persistence.transaction(async (tx) => {
      const current = await tx.lockRequest(requestId);
      if (current === null) throw new AppError('REQUEST_NOT_FOUND');
      if (!isOwner(identity, current)) throw new AppError('FORBIDDEN');
      if (current.version !== expectedVersion) throw new AppError('CONCURRENCY_CONFLICT');
      if (!canApply(operation, current.status)) throw new AppError('REQUEST_INVALID_STATE');

      const next = applyOperation(current, operation, now, content ?? {});
      await tx.requests.update(next);
      await recordAudit(tx, this.ids, {
        requestId,
        eventType: operation === 'update' ? 'REQUEST_UPDATED' : 'REQUEST_SUBMITTED',
        actorId: identity.subject,
        fromState: current.status,
        toState: next.status,
        at: now,
      });
      if (operation === 'submit') {
        await recordNotifications(tx, this.ids, {
          eventType: 'REQUEST_SUBMITTED',
          request: next,
          fromStatus: current.status,
          actorId: identity.subject,
          at: now,
        });
      }
      return next;
    });
  }
}
