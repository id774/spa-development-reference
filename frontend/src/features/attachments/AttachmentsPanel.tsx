// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { Attachment } from '@spa-ref/api-client';
import { Button, EmptyState, LoadingIndicator, Notification, Table } from '@spa-ref/ui';
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
    <section aria-labelledby="attachments-heading">
      <h2 id="attachments-heading">Attachments</h2>
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
            { key: 'name', header: 'File', render: (a) => a.fileName },
            { key: 'type', header: 'Type', render: (a) => a.mediaType },
            { key: 'size', header: 'Size', render: (a) => formatSize(a.sizeBytes) },
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
        <Button onClick={() => void list.loadMore()}>Load more attachments</Button>
      ) : null}
      {canUpload ? (
        <div>
          <label htmlFor="attachment-file">Attach a file</label>
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
      ) : null}
      {message ? <Notification>{message}</Notification> : null}
      {failure ? <ApiErrorView error={failure} /> : null}
    </section>
  );
}
