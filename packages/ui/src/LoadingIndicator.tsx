// License: The GPL version 3, or LGPL version 3 (Dual License).
export function LoadingIndicator({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="ui-loading">
      <span className="ui-spinner" aria-hidden="true" />
      {label}…
    </p>
  );
}
