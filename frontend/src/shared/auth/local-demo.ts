// frontend/src/shared/auth/local-demo.ts: local demo identities
//
// Description:
// The fixed, non-secret demo bearer tokens understood only by a backend
// started with APP_MODE=local, and the roles offered by the local demo
// sign-in. They are not credentials and are rejected in aws mode.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See frontend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
