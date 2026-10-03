// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ApiRequest } from '@spa-ref/api-client';
import { Button, EmptyState, LoadingIndicator, Table } from '@spa-ref/ui';
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
        { key: 'status', header: 'Status', render: (r) => r.status },
        { key: 'updated', header: 'Updated', render: (r) => formatDate(r.updatedAt) },
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
  return (
    <>
      <h2>{heading}</h2>
      {roles.includes('Requester') ? (
        <p>
          <Link to="/requests/new">Create Request</Link>
        </p>
      ) : null}
      {list.state === 'loading' ? <LoadingIndicator /> : null}
      {list.state === 'error' ? <ApiErrorView error={list.error} /> : null}
      {list.state === 'ready' && list.items.length === 0 ? (
        <EmptyState title="There are no requests yet." />
      ) : null}
      {list.items.length > 0 ? <RequestTable caption={heading} rows={list.items} /> : null}
      {list.hasMore ? <Button onClick={() => void list.loadMore()}>Load more</Button> : null}
    </>
  );
}
