// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { AuditEvent } from '@spa-ref/api-client';
import { Button, EmptyState, LoadingIndicator, Table, TextField } from '@spa-ref/ui';
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
      <h2>Audit history</h2>
      <form onSubmit={apply} noValidate>
        <TextField
          label="Request ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          error={error}
        />
        <Button type="submit">Filter</Button>
      </form>
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
            { key: 'when', header: 'When', render: (e) => formatDate(e.occurredAt) },
            { key: 'type', header: 'Event', render: (e) => e.eventType },
            { key: 'request', header: 'Request', render: (e) => e.requestId },
            { key: 'actor', header: 'Actor', render: (e) => e.actorId },
            {
              key: 'transition',
              header: 'Transition',
              render: (e) => `${e.fromState ?? '—'} → ${e.toState ?? '—'}`,
            },
          ]}
        />
      ) : null}
      {list.hasMore ? <Button onClick={() => void list.loadMore()}>Load more</Button> : null}
    </>
  );
}
