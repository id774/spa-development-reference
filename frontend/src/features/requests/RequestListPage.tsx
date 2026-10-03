// frontend/src/features/requests/RequestListPage.tsx: request list screen
//
// Description:
// Lists My Requests for a Requester and every request for an Administrator
// with cursor pagination, and exports the request table and date formatting
// reused by other screens.
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
import {
  Button,
  buttonClass,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  StatusBadge,
  Table,
} from '@spa-ref/ui';
import { Link } from 'react-router';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { usePagedList } from '../../shared/state/hooks.js';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function RequestTable({ caption, rows }: { caption: string; rows: ApiRequest[] }) {
  return (
    <Table
      caption={caption}
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        {
          key: 'title',
          header: 'Title',
          render: (r) => <Link to={`/requests/${r.id}`}>{r.title}</Link>,
        },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        {
          key: 'updated',
          header: 'Updated',
          render: (r) => <span className="ui-meta">{formatDate(r.updatedAt)}</span>,
        },
      ]}
    />
  );
}

/** My Requests for a Requester; every request for an Administrator. */
export function RequestListPage() {
  const { api, roles } = useAuth();
  const list = usePagedList<ApiRequest>(
    (cursor) => api.listRequests(cursor === undefined ? {} : { cursor }),
    'requests',
  );
  const heading = roles.includes('Requester') ? 'My Requests' : 'All Requests';
  const isRequester = roles.includes('Requester');
  return (
    <>
      <PageHeader
        title={heading}
        description={isRequester ? 'Requests you have created.' : 'Every request in the system.'}
        actions={
          isRequester ? (
            <Link to="/requests/new" className={buttonClass('primary')}>
              Create Request
            </Link>
          ) : undefined
        }
      />
      {list.state === 'loading' ? <LoadingIndicator /> : null}
      {list.state === 'error' ? <ApiErrorView error={list.error} /> : null}
      {list.state === 'ready' && list.items.length === 0 ? (
        <EmptyState title="There are no requests yet." />
      ) : null}
      {list.items.length > 0 ? <RequestTable caption={heading} rows={list.items} /> : null}
      {list.hasMore ? (
        <Button className="load-more" onClick={() => void list.loadMore()}>
          Load more
        </Button>
      ) : null}
    </>
  );
}
