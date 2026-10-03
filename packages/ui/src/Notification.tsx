// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ReactNode } from 'react';

/** A user-visible status message announced politely to assistive technology. */
export function Notification({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="ui-notification">
      {children}
    </p>
  );
}
