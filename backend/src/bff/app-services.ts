// backend/src/bff/app-services.ts: service container contract of the BFF
//
// Description:
// Defines the AppServices container handed to the HTTP layer: the identity
// provider, the local capability services, the immutable capability routing,
// the attachment size limit, the readiness probe, and the logger.
//
// It is the only dependency the controllers and guards take on the composed
// backend, which keeps the HTTP layer independent of how the services are
// built.
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

import type { AppLogger } from '../common/logging.js';
import type { CapabilityName } from '../common/config.js';
import type { ApprovalsService } from '../capabilities/approvals/application/approvals.service.js';
import type { AttachmentsService } from '../capabilities/attachments/application/attachments.service.js';
import type { AuditService } from '../capabilities/audit/application/audit.service.js';
import type { RequestsService } from '../capabilities/requests/application/requests.service.js';
import type { IdentityProvider } from '../capabilities/shared/identity.js';

export const APP_SERVICES = Symbol('APP_SERVICES');

/** Capabilities that are reachable through the dispatcher. */
export interface LocalCapabilities {
  requests: RequestsService;
  approvals: ApprovalsService;
  attachments: AttachmentsService;
  audit: AuditService;
}

export interface AppServices {
  identity: IdentityProvider;
  capabilities: LocalCapabilities;
  routing: Readonly<Record<CapabilityName, 'local'>>;
  attachmentMaxBytes: number;
  isReady: () => Promise<boolean>;
  logger: AppLogger;
}
