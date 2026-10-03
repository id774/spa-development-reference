// packages/ui/src/EmptyState.tsx: empty state component
//
// Description:
// A message shown when a list or screen has nothing to display.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
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

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty__icon" aria-hidden="true" />
      <p className="ui-empty__title">{title}</p>
      {children}
    </div>
  );
}
