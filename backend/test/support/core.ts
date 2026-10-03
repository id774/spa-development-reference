// backend/test/support/core.ts: test support: capability services on in-memory persistence
//
// Description:
// Creates the capability services on in-memory persistence with fake clock,
// ids, and object storage, for tests that exercise the application layer
// without HTTP. It is test support, not a test suite.
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

import { ApprovalsService } from '../../src/capabilities/approvals/application/approvals.service.js';
import { AttachmentsService } from '../../src/capabilities/attachments/application/attachments.service.js';
import { AuditService } from '../../src/capabilities/audit/application/audit.service.js';
import { RequestsService } from '../../src/capabilities/requests/application/requests.service.js';
import type { Persistence } from '../../src/capabilities/shared/ports.js';
import { silentLogger } from '../../src/common/logging.js';
import { FakeClock, FakeObjectStorage, SequentialIds } from './fakes.js';
import { InMemoryPersistence } from './in-memory-persistence.js';

export function createCore(persistence: Persistence = new InMemoryPersistence()) {
  const clock = new FakeClock();
  const ids = new SequentialIds();
  const storage = new FakeObjectStorage();
  return {
    persistence,
    clock,
    ids,
    storage,
    requests: new RequestsService(persistence, clock, ids),
    approvals: new ApprovalsService(persistence, clock, ids),
    attachments: new AttachmentsService(persistence, storage, clock, ids, silentLogger),
    audit: new AuditService(persistence),
  };
}

export type Core = ReturnType<typeof createCore>;
