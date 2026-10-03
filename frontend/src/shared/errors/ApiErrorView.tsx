// License: The GPL version 3, or LGPL version 3 (Dual License).
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
