// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  /** Disables the button and marks it busy while an action is running. */
  busy?: boolean;
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
      className={['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')}
    />
  );
}
