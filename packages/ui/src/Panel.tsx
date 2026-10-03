// License: The GPL version 3, or LGPL version 3 (Dual License).
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
