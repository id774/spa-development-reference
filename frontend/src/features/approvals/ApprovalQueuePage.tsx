// frontend/src/features/approvals/ApprovalQueuePage.tsx: approval queue screen
//
// Description:
// Approver screen that lists the submitted requests awaiting a decision,
// oldest first, and links each to its review screen.
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

import type { ApiRequest } from '@spa-ref/api-client';
import { Button, EmptyState, LoadingIndicator, PageHeader } from '@spa-ref/ui';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { usePagedList } from '../../shared/state/hooks.js';
import { RequestTable } from '../requests/RequestListPage.js';

/** Approval Queue: submitted requests awaiting a decision, oldest first. */
export function ApprovalQueuePage() {
  const { api } = useAuth();
  const list = usePagedList<ApiRequest>(
    (cursor) => api.listApprovals(cursor === undefined ? {} : { cursor }),
    'approvals',
  );
  return (
    <>
      <PageHeader title="Approval Queue" description="Submitted requests, oldest first." />
      {list.state === 'loading' ? <LoadingIndicator /> : null}
      {list.state === 'error' ? <ApiErrorView error={list.error} /> : null}
      {list.state === 'ready' && list.items.length === 0 ? (
        <EmptyState title="No requests are waiting for a decision." />
      ) : null}
      {list.items.length > 0 ? (
        <RequestTable caption="Waiting for a decision" rows={list.items} />
      ) : null}
      {list.hasMore ? (
        <Button className="load-more" onClick={() => void list.loadMore()}>
          Load more
        </Button>
      ) : null}
    </>
  );
}
