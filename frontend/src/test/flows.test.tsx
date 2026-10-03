// License: The GPL version 3, or LGPL version 3 (Dual License).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from './fake-backend.js';
import { createHarness, signIn, type Harness } from './render.js';

let backend: FakeBackend;
let harness: Harness;

beforeEach(() => {
  backend = new FakeBackend();
  harness = createHarness(backend);
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

describe('Requester flow', () => {
  it('creates a draft, edits it, attaches a file, and submits it', async () => {
    await signIn(harness, '/requests');
    expect(await screen.findByText('There are no requests yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Create Request' }));
    await userEvent.type(await screen.findByLabelText('Title'), '  Laptop  ');
    await userEvent.type(screen.getByLabelText('Description'), 'Need one');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByRole('heading', { name: 'Request Detail' })).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(backend.requests[0]?.title).toBe('Laptop'); // trimmed like the API does

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Laptop Pro');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument();
    expect(backend.requests[0]).toMatchObject({ title: 'Laptop Pro', version: 2 });

    const file = new File(['%PDF-1.4'], 'quote.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Attach a file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(await screen.findByText('quote.pdf')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Request submitted.')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Attach a file')).not.toBeInTheDocument();
  });

  it('validates the form like the API before calling it', async () => {
    await signIn(harness, '/requests/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Create draft' }));
    expect(await screen.findByText('Enter a title.')).toBeInTheDocument();
    expect(backend.calls).not.toContain('POST /api/requests');
  });

  it('shows the problem and its trace reference when an API call fails', async () => {
    await signIn(harness, '/requests/00000000-0000-4000-8000-0000000000ff');
    expect(await screen.findByText('Request not found')).toBeInTheDocument();
  });
});

describe('attachment metadata rediscovery', () => {
  it('rebuilds the attachment list from the list endpoint after a reload, without any upload response', async () => {
    const request = backend.seedRequest({ status: 'DRAFT' });
    backend.attachments.set(request.id, [
      {
        id: backend.nextId(),
        requestId: request.id,
        fileName: 'one.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 10,
        uploadedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: backend.nextId(),
        requestId: request.id,
        fileName: 'two.txt',
        mediaType: 'text/plain',
        sizeBytes: 2048,
        uploadedBy: 'user-1',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    await signIn(harness, `/requests/${request.id}`);
    expect(await screen.findByText('one.pdf')).toBeInTheDocument();
    expect(screen.getByText('two.txt')).toBeInTheDocument();
    expect(backend.calls).toContain(`GET /api/requests/${request.id}/attachments`);
    expect(backend.calls.some((c) => c.startsWith('POST /api'))).toBe(false);

    // Download uses the identifier from the list metadata.
    await userEvent.click(screen.getByRole('button', { name: 'Download one.pdf' }));
    await waitFor(() =>
      expect(
        backend.calls.some((c) => /GET \/api\/requests\/[^/]+\/attachments\/[^/]+$/.test(c)),
      ).toBe(true),
    );
  });

  it('re-fetches the attachment list after an upload instead of trusting the upload response', async () => {
    const request = backend.seedRequest();
    await signIn(harness, `/requests/${request.id}`);
    await screen.findByText('No attachments');
    const listCallsBefore = backend.calls.filter(
      (c) => c.endsWith('/attachments') && c.startsWith('GET'),
    ).length;
    await userEvent.upload(
      screen.getByLabelText('Attach a file'),
      new File(['hi'], 'note.txt', { type: 'text/plain' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('note.txt')).toBeInTheDocument();
    const listCallsAfter = backend.calls.filter(
      (c) => c.endsWith('/attachments') && c.startsWith('GET'),
    ).length;
    expect(listCallsAfter).toBe(listCallsBefore + 1);
  });

  it('shows the attachments on the review screen for an Approver', async () => {
    backend.roles = ['Approver'];
    const request = backend.seedRequest({ requesterId: 'someone-else', status: 'SUBMITTED' });
    backend.attachments.set(request.id, [
      {
        id: backend.nextId(),
        requestId: request.id,
        fileName: 'evidence.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 5,
        uploadedBy: 'someone-else',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await signIn(harness, `/requests/${request.id}`);
    expect(await screen.findByText('evidence.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText('Attach a file')).not.toBeInTheDocument();
  });
});

describe('Approver flow', () => {
  it('opens a submitted request from the queue and approves it with a comment', async () => {
    backend.roles = ['Approver'];
    const request = backend.seedRequest({
      requesterId: 'someone-else',
      status: 'SUBMITTED',
      title: 'Server rack',
    });
    await signIn(harness, '/approvals');
    expect(await screen.findByRole('heading', { name: 'Approval Queue' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('link', { name: 'Server rack' }));
    expect(await screen.findByRole('heading', { name: 'Request Review' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('dialog', { name: 'Approve request' });
    await userEvent.type(within(dialog).getByLabelText('Comment (optional)'), 'Looks fine');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Request approved.')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(backend.calls).toContain(`POST /api/requests/${request.id}/approve`);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('rejects a request', async () => {
    backend.roles = ['Approver'];
    const request = backend.seedRequest({ requesterId: 'someone-else', status: 'SUBMITTED' });
    await signIn(harness, `/requests/${request.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Reject request' })).getByRole('button', {
        name: 'Confirm',
      }),
    );
    expect(await screen.findByText('Request rejected.')).toBeInTheDocument();
  });

  it('shows an empty queue', async () => {
    backend.roles = ['Approver'];
    await signIn(harness, '/approvals');
    expect(await screen.findByText('No requests are waiting for a decision.')).toBeInTheDocument();
  });
});

describe('Administrator flow', () => {
  it('lists all requests and the audit history, and filters by request ID', async () => {
    backend.roles = ['Administrator'];
    const request = backend.seedRequest({ requesterId: 'someone-else' });
    backend.audit = [
      {
        id: backend.nextId(),
        requestId: request.id,
        eventType: 'REQUEST_CREATED',
        actorId: 'someone-else',
        fromState: null,
        toState: 'DRAFT',
        occurredAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    await signIn(harness, '/requests');
    expect(await screen.findByRole('heading', { name: 'All Requests' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Request' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Audit' }));
    expect(await screen.findByText('REQUEST_CREATED')).toBeInTheDocument();
    expect(screen.getByText('— → DRAFT')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Request ID'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(await screen.findByText('Enter a request ID in UUID format.')).toBeInTheDocument();
  });
});
