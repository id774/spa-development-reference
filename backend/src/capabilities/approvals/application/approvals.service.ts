// License: The GPL version 3, or LGPL version 3 (Dual License).
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
import { applyOperation, canApply, type RequestRecord } from '../../requests/domain/request.js';

export interface Decision {
  version: number;
  comment: string | null;
}

export class ApprovalsService {
  constructor(
    private readonly persistence: Persistence,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Approver: SUBMITTED requests, oldest submission first. */
  async queue(identity: Identity, input: ListInput): Promise<PageResult<RequestRecord>> {
    if (!hasRole(identity, 'Approver')) throw new AppError('FORBIDDEN');
    const after = input.cursor ? decodeCursor(input.cursor, 'approvals', '') : undefined;
    const rows = await this.persistence.repositories.requests.listSubmitted({
      ...(after ? { after } : {}),
      limit: input.limit + 1,
    });
    return buildPage(rows, input.limit, (r) => ({ at: r.updatedAt, id: r.id }), 'approvals', '');
  }

  approve(identity: Identity, requestId: string, decision: Decision): Promise<RequestRecord> {
    return this.decide(identity, requestId, 'approve', decision);
  }

  reject(identity: Identity, requestId: string, decision: Decision): Promise<RequestRecord> {
    return this.decide(identity, requestId, 'reject', decision);
  }

  /**
   * One local transaction: lock, version, state, request update, approval row
   * (unique per request), audit event, and the EMAIL and EVENT outbox rows.
   */
  private async decide(
    identity: Identity,
    requestId: string,
    operation: 'approve' | 'reject',
    decision: Decision,
  ): Promise<RequestRecord> {
    if (!hasRole(identity, 'Approver')) throw new AppError('FORBIDDEN');
    const now = this.clock.now();
    return this.persistence.transaction(async (tx) => {
      const current = await tx.lockRequest(requestId);
      if (current === null) throw new AppError('REQUEST_NOT_FOUND');
      if (current.version !== decision.version) throw new AppError('CONCURRENCY_CONFLICT');
      if (!canApply(operation, current.status)) throw new AppError('REQUEST_INVALID_STATE');

      const next = applyOperation(current, operation, now);
      const approvalId = this.ids.uuid();
      await tx.requests.update(next);
      await tx.approvals.insert({
        id: approvalId,
        requestId,
        approverId: identity.subject,
        decision: operation === 'approve' ? 'APPROVED' : 'REJECTED',
        comment: decision.comment,
        decidedAt: now,
      });
      const eventType = operation === 'approve' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED';
      await recordAudit(tx, this.ids, {
        requestId,
        eventType,
        actorId: identity.subject,
        fromState: current.status,
        toState: next.status,
        details: { approvalId },
        at: now,
      });
      await recordNotifications(tx, this.ids, {
        eventType,
        request: next,
        fromStatus: current.status,
        actorId: identity.subject,
        at: now,
      });
      return next;
    });
  }
}
