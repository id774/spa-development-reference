// packages/ui/src/ErrorMessage.tsx: error message component
//
// Description:
// A failure message with a title, optional detail, and an optional support
// reference such as a trace identifier.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
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

export function ErrorMessage({
  title,
  detail,
  reference,
}: {
  title: string;
  detail?: string | undefined;
  /** A support reference such as a trace identifier. */
  reference?: string | undefined;
}) {
  return (
    <div role="alert" className="ui-error">
      <p className="ui-error__title">{title}</p>
      {detail ? <p className="ui-error__detail">{detail}</p> : null}
      {reference ? <p className="ui-error__reference">Reference: {reference}</p> : null}
    </div>
  );
}
