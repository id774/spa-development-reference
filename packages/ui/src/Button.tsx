// packages/ui/src/Button.tsx: button component
//
// Description:
// A button with primary, secondary, and danger variants. A busy button is
// disabled and marked busy. buttonClass exposes the class names so that a link
// can look like a button without becoming one.
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

import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Disables the button and marks it busy while an action is running. */
  busy?: boolean;
}

/** Class names of a button, so that a link can look like one without becoming one. */
export function buttonClass(variant: ButtonProps['variant'] = 'secondary'): string {
  return `ui-button ui-button--${variant}`;
}

export function Button({
  variant = 'secondary',
  busy = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={[buttonClass(variant), className].filter(Boolean).join(' ')}
    />
  );
}
