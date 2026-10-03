// License: The GPL version 3, or LGPL version 3 (Dual License).
import { PageHeader, Panel } from '@spa-ref/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../shared/auth/AuthProvider.js';
import { ApiErrorView } from '../../shared/errors/ApiErrorView.js';
import { RequestForm } from './RequestForm.js';

export function RequestNewPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function create(values: { title: string; description: string }) {
    setBusy(true);
    setFailure(null);
    try {
      const created = await api.createRequest(values);
      void navigate(`/requests/${created.id}`);
    } catch (error) {
      setFailure(error);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create Request"
        description="Start with a draft. You can edit it and attach files before submitting."
      />
      <div className="form-panel">
        <Panel>
          <RequestForm
            initial={{ title: '', description: '' }}
            submitLabel="Create draft"
            busy={busy}
            onSubmit={(v) => void create(v)}
          />
        </Panel>
      </div>
      {failure ? <ApiErrorView error={failure} /> : null}
    </>
  );
}
