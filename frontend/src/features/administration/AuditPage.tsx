// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { AuditEvent } from '@spa-ref/api-client';
import {
  Button,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  Panel,
  Table,
  TextField,
} from '@spa-ref/ui';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { usePagedList } from '../../shared/state/hooks.js';
import { formatDate } from '../requests/RequestListPage.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Audit history (Administrator): newest first, optionally for one request. */
export function AuditPage() {
  const { api } = useAuth();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const list = usePagedList<AuditEvent>(
    (cursor) =>
      api.listAuditEvents({
        ...(filter === undefined ? {} : { requestId: filter }),
        ...(cursor === undefined ? {} : { cursor }),
      }),
    filter ?? '',
  );

  function apply(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (value !== '' && !UUID.test(value)) {
      setError('Enter a request ID in UUID format.');
      return;
    }
    setError(undefined);
    setFilter(value === '' ? undefined : value);
  }

  return (
    <>
      <PageHeader
        title="Audit history"
        description="Business events, newest first. Filter by request to follow one request."
      />
      <Panel>
        <form onSubmit={apply} noValidate className="filter-form">
          <TextField
            label="Request ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={error}
          />
          <Button type="submit">Filter</Button>
        </form>
      </Panel>
      {list.state === 'loading' ? <LoadingIndicator /> : null}
      {list.state === 'error' ? <ApiErrorView error={list.error} /> : null}
      {list.state === 'ready' && list.items.length === 0 ? (
        <EmptyState title="No audit events." />
      ) : null}
      {list.items.length > 0 ? (
        <Table
          caption="Audit events"
          rows={list.items}
          rowKey={(e) => e.id}
          columns={[
            {
              key: 'when',
              header: 'When',
              render: (e) => <span className="ui-meta">{formatDate(e.occurredAt)}</span>,
            },
            {
              key: 'type',
              header: 'Event',
              render: (e) => <code className="ui-code">{e.eventType}</code>,
            },
            {
              key: 'request',
              header: 'Request',
              render: (e) => <code className="ui-code">{e.requestId}</code>,
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (e) => <span className="ui-meta">{e.actorId}</span>,
            },
            {
              key: 'transition',
              header: 'Transition',
              render: (e) => <span>{`${e.fromState ?? '—'} → ${e.toState ?? '—'}`}</span>,
            },
          ]}
        />
      ) : null}
      {list.hasMore ? (
        <Button className="load-more" onClick={() => void list.loadMore()}>
          Load more
        </Button>
      ) : null}
    </>
  );
}
