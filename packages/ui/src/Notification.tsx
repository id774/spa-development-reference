// packages/ui/src/Notification.tsx: status notification component
//
// Description:
// A user-visible status message that is announced politely to assistive
// technology.
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
// - See packages/ui/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import type { ReactNode } from 'react';

/** A user-visible status message announced politely to assistive technology. */
export function Notification({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="ui-notification">
      {children}
    </p>
  );
}
