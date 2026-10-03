// License: The GPL version 3, or LGPL version 3 (Dual License).
import { AppError } from '../../../common/errors.js';
import {
  buildPage,
  decodeCursor,
  type ListInput,
  type PageResult,
} from '../../../common/cursor.js';
import { hasRole, type Identity } from '../../shared/identity.js';
import type { AuditRecord, Persistence } from '../../shared/ports.js';

export class AuditService {
  constructor(private readonly persistence: Persistence) {}

  /** Administrator only. The cursor is bound to the optional requestId filter. */
  async list(
    identity: Identity,
    input: ListInput & { requestId?: string | undefined },
  ): Promise<PageResult<AuditRecord>> {
    if (!hasRole(identity, 'Administrator')) throw new AppError('FORBIDDEN');
    const binding = input.requestId ?? '';
    const after = input.cursor ? decodeCursor(input.cursor, 'audit', binding) : undefined;
    const rows = await this.persistence.repositories.audit.list({
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      ...(after ? { after } : {}),
      limit: input.limit + 1,
    });
    return buildPage(rows, input.limit, (r) => ({ at: r.occurredAt, id: r.id }), 'audit', binding);
  }
}
