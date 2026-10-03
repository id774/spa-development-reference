// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { ApiRequest } from '@spa-ref/api-client';
import { Button, Dialog, LoadingIndicator, Notification, TextAreaField } from '@spa-ref/ui';
import { useState } from 'react';
import { useParams } from 'react-router';
import { AttachmentsPanel } from '../attachments/AttachmentsPanel.js';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { useResource } from '../../shared/state/hooks.js';
import { RequestForm } from './RequestForm.js';
import { formatDate } from './RequestListPage.js';

type Decision = 'approve' | 'reject';

/**
 * Request Detail (Requester, Administrator) and Request Review (Approver). The
 * request and its attachments are loaded from GET endpoints, so the screen can
 * always be rebuilt after a reload.
 */
export function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const { api, roles, session } = useAuth();
  const { resource, set, reload } = useResource(() => api.getRequest(requestId), requestId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState('');

  async function run(action: () => Promise<ApiRequest>, success: string) {
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      set(await action());
      setMessage(success);
      setDecision(null);
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  if (resource.state === 'loading') return <LoadingIndicator />;
  if (resource.state === 'error') return <ApiErrorView error={resource.error} />;

  const request = resource.data;
  const isOwner = session?.subject === request.requesterId;
  const canEdit = roles.includes('Requester') && isOwner && request.status === 'DRAFT';
  const canDecide = roles.includes('Approver') && request.status === 'SUBMITTED';
  const heading = canDecide && !isOwner ? 'Request Review' : 'Request Detail';

  return (
    <>
      <h2>{heading}</h2>
      <dl>
        <dt>Title</dt>
        <dd>{request.title}</dd>
        <dt>Description</dt>
        <dd style={{ whiteSpace: 'pre-wrap' }}>{request.description}</dd>
        <dt>Status</dt>
        <dd>{request.status}</dd>
        <dt>Updated</dt>
        <dd>{formatDate(request.updatedAt)}</dd>
      </dl>

      {canEdit ? (
        <>
          <h3>Edit Draft Request</h3>
          <RequestForm
            key={request.version}
            initial={{ title: request.title, description: request.description }}
            submitLabel="Save draft"
            busy={busy}
            onSubmit={(values) =>
              void run(
                () => api.updateDraftRequest(request.id, { ...values, version: request.version }),
                'Draft saved.',
              )
            }
          />
          <Button
            variant="primary"
            busy={busy}
            onClick={() =>
              void run(
                () => api.submitRequest(request.id, { version: request.version }),
                'Request submitted.',
              )
            }
          >
            Submit
          </Button>
        </>
      ) : null}

      {canDecide ? (
        <div>
          <Button variant="primary" onClick={() => setDecision('approve')}>
            Approve
          </Button>{' '}
          <Button variant="danger" onClick={() => setDecision('reject')}>
            Reject
          </Button>
        </div>
      ) : null}

      {decision !== null ? (
        <Dialog
          title={decision === 'approve' ? 'Approve request' : 'Reject request'}
          onClose={() => setDecision(null)}
        >
          <TextAreaField
            label="Comment (optional)"
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            variant={decision === 'approve' ? 'primary' : 'danger'}
            busy={busy}
            onClick={() => {
              const body = {
                version: request.version,
                ...(comment.trim() === '' ? {} : { comment }),
              };
              void run(
                () =>
                  decision === 'approve'
                    ? api.approveRequest(request.id, body)
                    : api.rejectRequest(request.id, body),
                decision === 'approve' ? 'Request approved.' : 'Request rejected.',
              );
            }}
          >
            Confirm
          </Button>{' '}
          <Button onClick={() => setDecision(null)}>Cancel</Button>
        </Dialog>
      ) : null}

      {message ? <Notification>{message}</Notification> : null}
      {failure ? (
        <>
          <ApiErrorView error={failure} />
          <Button onClick={reload}>Reload request</Button>
        </>
      ) : null}

      <AttachmentsPanel requestId={request.id} canUpload={canEdit} />
    </>
  );
}
