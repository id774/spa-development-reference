// backend/src/capabilities/audit/application/audit.service.ts: audit capability service
//
// Description:
// Lists audit events for the Administrator role with keyset pagination. The
// cursor is bound to the optional request identifier filter, so a cursor
// cannot be reused with a different filter.
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
