// License: The GPL version 3, or LGPL version 3 (Dual License).
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
