// packages/ui/src/ui.test.tsx: tests of the UI components
//
// Description:
// Pins the accessible behavior of the shared components: the shell regions, a
// busy button, field label, hint, and error association, tables and state
// components, dialog closing on Escape, and the text of status badges.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole UI suite:
//         npm run test -w @spa-ref/ui
//
//     Run this file:
//         npm run test -w @spa-ref/ui -- src/ui.test.tsx
//
// Test Cases:
//     - Shell with navigation and account area
//     - Busy button disabled
//     - Field label, hint, and error association
//     - Table, empty, loading, error, and notification
//     - Dialog closes on Escape
//     - Page header, panel, and status badge text
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See packages/ui/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AppShell,
  Button,
  Dialog,
  EmptyState,
  ErrorMessage,
  LoadingIndicator,
  Notification,
  PageHeader,
  Panel,
  StatusBadge,
  Table,
  TextField,
} from './index.js';

describe('ui components', () => {
  it('renders the shell with navigation and account area', () => {
    render(
      <AppShell
        title="Reference"
        navigation={[{ key: 'a', label: 'A', element: <a href="/a">A</a> }]}
        account={<span>me</span>}
      >
        content
      </AppShell>,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveTextContent('A');
    expect(screen.getByRole('main')).toHaveTextContent('content');
    expect(screen.getByText('me')).toBeInTheDocument();
  });

  it('disables a busy button', () => {
    render(<Button busy>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('associates a field label, hint, and error', () => {
    render(<TextField label="Title" hint="Short" error="Required" />);
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Short Required');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('renders a table, empty state, loading, error, and notification', () => {
    render(
      <>
        <Table
          caption="Items"
          columns={[{ key: 'n', header: 'Name', render: (r: { n: string }) => r.n }]}
          rows={[{ n: 'one' }]}
          rowKey={(r) => r.n}
        />
        <EmptyState title="Nothing" />
        <LoadingIndicator />
        <ErrorMessage title="Failed" detail="Try again" reference="trace-1" />
        <Notification>Saved</Notification>
      </>,
    );
    expect(screen.getByRole('table', { name: 'Items' })).toHaveTextContent('one');
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((e) => e.textContent)).toEqual(['Loading…', 'Saved']);
    expect(screen.getByRole('alert')).toHaveTextContent('Reference: trace-1');
  });

  it('closes a dialog on Escape', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Confirm" onClose={onClose}>
        body
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a page header, a panel, and status badges with their text', () => {
    render(
      <>
        <PageHeader
          title="Request Detail"
          description="About"
          badge={<StatusBadge status="APPROVED" />}
          actions={<button type="button">Act</button>}
        />
        <Panel title="Overview">body</Panel>
        <StatusBadge status="REJECTED" />
        <StatusBadge status="UNKNOWN" />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Request Detail' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Overview' })).toHaveTextContent('body');
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toHaveClass('ui-badge--success');
    expect(screen.getByText('REJECTED')).toHaveClass('ui-badge--danger');
    expect(screen.getByText('UNKNOWN')).toHaveClass('ui-badge--neutral');
  });
});
