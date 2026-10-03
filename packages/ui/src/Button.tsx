// License: The GPL version 3, or LGPL version 3 (Dual License).
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
