// License: The GPL version 3, or LGPL version 3 (Dual License).
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
