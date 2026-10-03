// License: The GPL version 3, or LGPL version 3 (Dual License).
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
