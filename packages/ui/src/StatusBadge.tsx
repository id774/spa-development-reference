// packages/ui/src/StatusBadge.tsx: status badge component
//
// Description:
// A request status shown as a chip. The text always carries the meaning and
// the color only reinforces it.
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

const TONES: Readonly<Record<string, string>> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** A request status as a chip. The text always carries the meaning; the color only reinforces it. */
export function StatusBadge({ status }: { status: string }) {
  return <span className={`ui-badge ui-badge--${TONES[status] ?? 'neutral'}`}>{status}</span>;
}
