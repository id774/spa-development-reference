// backend/src/compose.ts: composition root of the capability services
//
// Description:
// Builds the capability services (requests, approvals, attachments, audit)
// from the persistence, identity, object-storage, clock, id, and logger
// dependencies and returns them as AppServices.
//
// All current capabilities are local, in-process services. This file wires
// them together and contains no business rules.
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

import type { AppServices } from './bff/app-services.js';
import { ApprovalsService } from './capabilities/approvals/application/approvals.service.js';
import { AttachmentsService } from './capabilities/attachments/application/attachments.service.js';
import { AuditService } from './capabilities/audit/application/audit.service.js';
import { RequestsService } from './capabilities/requests/application/requests.service.js';
import type { IdentityProvider } from './capabilities/shared/identity.js';
import type { ObjectStorage, Persistence } from './capabilities/shared/ports.js';
import type { CapabilityName } from './common/config.js';
import type { AppLogger } from './common/logging.js';
import type { Clock, IdGenerator } from './common/ports.js';

export interface ComposeInput {
  persistence: Persistence;
  identity: IdentityProvider;
  storage: ObjectStorage;
  clock: Clock;
  ids: IdGenerator;
  logger: AppLogger;
  routing: Readonly<Record<CapabilityName, 'local'>>;
  attachmentMaxBytes: number;
  isReady: () => Promise<boolean>;
}

/** Composition root of the capabilities: all current capabilities are local. */
export function composeServices(input: ComposeInput): AppServices {
  const { persistence, clock, ids, logger } = input;
  return {
    identity: input.identity,
    capabilities: {
      requests: new RequestsService(persistence, clock, ids),
      approvals: new ApprovalsService(persistence, clock, ids),
      attachments: new AttachmentsService(persistence, input.storage, clock, ids, logger),
      audit: new AuditService(persistence),
    },
    routing: input.routing,
    attachmentMaxBytes: input.attachmentMaxBytes,
    isReady: input.isReady,
    logger,
  };
}
