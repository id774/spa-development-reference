// packages/ui/src/Panel.tsx: panel component
//
// Description:
// A surface that groups related content under an optional section heading and
// description.
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

import { useId, type ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

/** A surface that groups related content under an optional section heading. */
export function Panel({ title, description, children }: PanelProps) {
  const titleId = useId();
  return (
    <section className="ui-panel" aria-labelledby={title ? titleId : undefined}>
      {title ? (
        <div className="ui-panel__header">
          <h3 id={titleId} className="ui-panel__title">
            {title}
          </h3>
          {description ? <p className="ui-panel__description">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
