// frontend/src/features/attachments/AttachmentsPanel.tsx: attachments panel of a request
//
// Description:
// Lists, uploads, and downloads the attachments of one request. The metadata
// always comes from the attachment list endpoint, so it can be rebuilt after a
// reload, and an upload re-fetches the list instead of trusting the upload
// response alone.
//
// Upload is offered only when the caller may upload; the server still enforces
// role, ownership, and state.
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

import type { Attachment } from '@spa-ref/api-client';
import { Button, EmptyState, LoadingIndicator, Notification, Panel, Table } from '@spa-ref/ui';
import { useRef, useState } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { usePagedList } from '../../shared/state/hooks.js';

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`;
}

/**
 * Attachment metadata always comes from the attachment list endpoint, so it can
 * be rebuilt after a reload. An upload re-fetches the list instead of trusting
 * the upload response alone.
 */
export function AttachmentsPanel({
  requestId,
  canUpload,
}: {
  requestId: string;
  canUpload: boolean;
}) {
  const { api } = useAuth();
  const list = usePagedList<Attachment>(
    (cursor) => api.listAttachments(requestId, cursor === undefined ? {} : { cursor }),
    requestId,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  async function upload() {
    const file = fileInput.current?.files?.[0];
    if (file === undefined) return;
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      await api.uploadAttachment(requestId, file);
      if (fileInput.current) fileInput.current.value = '';
      setMessage('Attachment uploaded.');
      list.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function download(attachment: Attachment) {
    setFailure(null);
    try {
      const { blob, fileName } = await api.downloadAttachment(requestId, attachment);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFailure(error);
    }
  }

  return (
    <Panel title="Attachments">
      {list.state === 'loading' ? <LoadingIndicator label="Loading attachments" /> : null}
      {list.state === 'error' ? <ApiErrorView error={list.error} /> : null}
      {list.state === 'ready' && list.items.length === 0 ? (
        <EmptyState title="No attachments" />
      ) : null}
      {list.items.length > 0 ? (
        <Table
          caption="Attachments"
          rows={list.items}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'name',
              header: 'File',
              render: (a) => <span className="file-name">{a.fileName}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              render: (a) => <span className="ui-meta">{a.mediaType}</span>,
            },
            {
              key: 'size',
              header: 'Size',
              render: (a) => <span className="ui-meta">{formatSize(a.sizeBytes)}</span>,
            },
            {
              key: 'action',
              header: 'Download',
              render: (a) => (
                <Button onClick={() => void download(a)} aria-label={`Download ${a.fileName}`}>
                  Download
                </Button>
              ),
            },
          ]}
        />
      ) : null}
      {list.hasMore ? (
        <Button className="load-more" onClick={() => void list.loadMore()}>
          Load more attachments
        </Button>
      ) : null}
      {canUpload ? (
        <div className="attachment-upload">
          <label htmlFor="attachment-file">Attach a file</label>
          <div className="attachment-upload__row">
            <input
              id="attachment-file"
              ref={fileInput}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
            />
            <Button variant="primary" busy={busy} onClick={() => void upload()}>
              Upload
            </Button>
          </div>
        </div>
      ) : null}
      {message ? <Notification>{message}</Notification> : null}
      {failure ? <ApiErrorView error={failure} /> : null}
    </Panel>
  );
}
