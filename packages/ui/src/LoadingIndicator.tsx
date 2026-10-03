// packages/ui/src/LoadingIndicator.tsx: loading indicator component
//
// Description:
// A busy indicator with an accessible label.
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

export function LoadingIndicator({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="ui-loading">
      <span className="ui-spinner" aria-hidden="true" />
      {label}…
    </p>
  );
}
