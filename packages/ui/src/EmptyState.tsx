// License: The GPL version 3, or LGPL version 3 (Dual License).
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
