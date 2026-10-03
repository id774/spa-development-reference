// packages/ui/src/PageHeader.tsx: page header component
//
// Description:
// The title area of a page: a title, an optional description, a badge shown
// next to the title, and primary actions aligned to the end.
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

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Shown next to the title, for example a status badge. */
  badge?: ReactNode;
  /** Primary actions, aligned to the end. */
  actions?: ReactNode;
}

/** The title area of a page. */
export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__text">
        <div className="ui-page-header__title-row">
          <h2 className="ui-page-header__title">{title}</h2>
          {badge}
        </div>
        {description ? <p className="ui-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}
