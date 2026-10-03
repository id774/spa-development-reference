// frontend/src/shared/errors/ApiErrorView.tsx: API failure presentation
//
// Description:
// Presents a failed API call using only the public problem fields (title,
// detail, and trace reference) and nothing beyond them.
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
// - See frontend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { ApiError } from '@spa-ref/api-client';
import { ErrorMessage } from '@spa-ref/ui';

/** Presents a failed API call without exposing anything beyond the public problem fields. */
export function ApiErrorView({ error }: { error: unknown }) {
  if (error instanceof ApiError) {
    return (
      <ErrorMessage
        title={error.problem?.title ?? `The request failed (${error.status})`}
        detail={error.problem?.detail}
        reference={error.problem?.traceId}
      />
    );
  }
  return (
    <ErrorMessage
      title="The server could not be reached."
      detail="Check your connection and try again."
    />
  );
}
