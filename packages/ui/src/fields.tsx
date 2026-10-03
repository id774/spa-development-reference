// License: The GPL version 3, or LGPL version 3 (Dual License).
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldFrameProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  id: string;
  children: ReactNode;
}

function FieldFrame({ label, error, hint, id, children }: FieldFrameProps) {
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-field__label">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="ui-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="ui-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type Common = { label: string; error?: string | undefined; hint?: string | undefined };

export function TextField({
  label,
  error,
  hint,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <input
        {...rest}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <textarea
        {...rest}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      />
    </FieldFrame>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <select
        {...rest}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
      >
        {children}
      </select>
    </FieldFrame>
  );
}
