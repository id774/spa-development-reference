// packages/ui/src/AppShell.tsx: application layout component
//
// Description:
// The page layout with a header, navigation, an account area, and the main
// content. Navigation items are rendered by the application so that it can use
// its own router link.
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

export interface NavItem {
  key: string;
  label: string;
  /** Rendered by the application so that it can use its own router link. */
  element: ReactNode;
}

export interface AppShellProps {
  title: string;
  navigation: NavItem[];
  /** Account area, for example the signed-in user and a sign-out button. */
  account?: ReactNode;
  children: ReactNode;
}

/** Application layout: header, navigation, and main content. */
export function AppShell({ title, navigation, account, children }: AppShellProps) {
  return (
    <div className="ui-shell">
      <header className="ui-shell__header">
        <h1 className="ui-shell__title">
          <span className="ui-shell__mark" aria-hidden="true" />
          {title}
        </h1>
        <nav aria-label="Main" className="ui-shell__nav">
          <ul>
            {navigation.map((item) => (
              <li key={item.key}>{item.element}</li>
            ))}
          </ul>
        </nav>
        {account ? <div className="ui-shell__account">{account}</div> : null}
      </header>
      <main className="ui-shell__main">{children}</main>
    </div>
  );
}
