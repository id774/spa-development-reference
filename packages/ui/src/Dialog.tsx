// packages/ui/src/Dialog.tsx: modal dialog component
//
// Description:
// A modal dialog with a title that closes on Escape.
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

import { useEffect, useId, type ReactNode } from 'react';

export interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A modal dialog that closes on Escape. */
export function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="ui-dialog__backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="ui-dialog">
        <h2 id={titleId} className="ui-dialog__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
