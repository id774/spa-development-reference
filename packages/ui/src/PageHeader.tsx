// License: The GPL version 3, or LGPL version 3 (Dual License).
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
