// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { SessionRole } from '@spa-ref/api-client';

/**
 * Fixed, non-secret demo tokens understood only by a backend started with
 * APP_MODE=local. They are not credentials and are rejected in aws mode.
 */
export const LOCAL_DEMO_TOKENS: Readonly<Record<SessionRole, string>> = {
  Requester: 'demo-requester',
  Approver: 'demo-approver',
  Administrator: 'demo-administrator',
};

export const LOCAL_DEMO_ROLES: readonly SessionRole[] = ['Requester', 'Approver', 'Administrator'];
