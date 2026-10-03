// frontend/src/features/requests/RequestDetailPage.tsx: request detail and review screen
//
// Description:
// Request Detail for a Requester or Administrator and Request Review for an
// Approver. The request and its attachments are loaded from GET endpoints, so
// the screen can always be rebuilt after a reload.
//
// It offers edit and submit to the owning Requester and approve and reject
// with a comment to an Approver, always sending the version it displayed so
// that conflicts are reported by the server.
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
  Dialog,
  LoadingIndicator,
  Notification,
  PageHeader,
  Panel,
  StatusBadge,
  TextAreaField,
} from '@spa-ref/ui';
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
      <PageHeader title={heading} badge={<StatusBadge status={request.status} />} />

      {message ? <Notification>{message}</Notification> : null}
      {failure ? (
        <>
          <ApiErrorView error={failure} />
          <div className="action-row">
            <Button onClick={reload}>Reload request</Button>
          </div>
        </>
      ) : null}

      <Panel title="Overview">
        <dl className="detail-list">
          <dt>Title</dt>
          <dd className="detail-list__title">{request.title}</dd>
          <dt>Description</dt>
          <dd className="detail-list__text">{request.description}</dd>
          <dt>Updated</dt>
          <dd>{formatDate(request.updatedAt)}</dd>
        </dl>
      </Panel>

      {canEdit ? (
        <>
          <Panel title="Edit Draft Request">
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
          </Panel>
          <Panel
            title="Submit for approval"
            description="Submitting sends the draft to an Approver. A submitted request can no longer be edited."
          >
            <div className="action-row">
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
            </div>
          </Panel>
        </>
      ) : null}

      {canDecide ? (
        <Panel
          title="Decision"
          description="Approve or reject this request. You may add a comment."
        >
          <div className="action-row">
            <Button variant="primary" onClick={() => setDecision('approve')}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => setDecision('reject')}>
              Reject
            </Button>
          </div>
        </Panel>
      ) : null}

      <AttachmentsPanel requestId={request.id} canUpload={canEdit} />

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
          <div className="ui-dialog__actions">
            <Button onClick={() => setDecision(null)}>Cancel</Button>
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
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
