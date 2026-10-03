// frontend/src/test/local-demo.test.tsx: tests of the local demo sign-in
//
// Description:
// Pins the local demo mode of the SPA: runtime configuration validation by
// authMode, the role selection screen without external sign-in, the session
// derived from the server, nothing kept in browser storage, and role
// switching.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole frontend suite:
//         npm run test -w @spa-ref/frontend
//
//     Run this file:
//         npm run test -w @spa-ref/frontend -- src/test/local-demo.test.tsx
//
// Test Cases:
//     - authMode validation of the runtime configuration
//     - Three roles and no external sign-in
//     - Server-derived session and empty browser storage
//     - Role switching and rejected selection
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

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigurationError, parseRuntimeConfig } from '../app/config.js';
import { FakeBackend } from './fake-backend.js';
import { createHarness, localConfig, renderApp, type Harness } from './render.js';

let backend: FakeBackend;
let harness: Harness;

beforeEach(() => {
  backend = new FakeBackend();
  backend.tokenIdentities.set('demo-requester', {
    subject: 'local-requester',
    roles: ['Requester'],
  });
  backend.tokenIdentities.set('demo-approver', { subject: 'local-approver', roles: ['Approver'] });
  backend.tokenIdentities.set('demo-administrator', {
    subject: 'local-administrator',
    roles: ['Administrator'],
  });
  for (const token of ['demo-requester', 'demo-approver', 'demo-administrator']) {
    backend.validTokens.add(token);
  }
  harness = createHarness(backend);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('runtime configuration authMode', () => {
  it('accepts the local mode without any Cognito value', () => {
    expect(parseRuntimeConfig({ authMode: 'local' })).toEqual({ authMode: 'local' });
  });

  it('rejects a missing or unknown authMode', () => {
    expect(() => parseRuntimeConfig({})).toThrow(ConfigurationError);
    expect(() => parseRuntimeConfig({ authMode: 'other' })).toThrow(ConfigurationError);
  });

  it('keeps the cognito mode strict', () => {
    expect(() => parseRuntimeConfig({ authMode: 'cognito' })).toThrow(ConfigurationError);
  });
});

describe('local demo sign-in', () => {
  it('offers the three roles and no external sign-in', async () => {
    renderApp(harness, '/requests', localConfig);
    expect(
      await screen.findByRole('button', { name: 'Continue as Requester' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Approver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Administrator' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('derives the session from the server for the selected role and keeps nothing in browser storage', async () => {
    renderApp(harness, '/requests', localConfig);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue as Approver' }));
    expect(await screen.findByText('local-approver')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Approval Queue' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument();
    expect(backend.calls).toContain('GET /api/session');
    expect(harness.browser.redirect).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('switches roles by signing out locally without leaving the page', async () => {
    renderApp(harness, '/requests', localConfig);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue as Administrator' }));
    expect(await screen.findByRole('link', { name: 'Audit' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'You are signed out' })).toBeInTheDocument(),
    );
    expect(harness.browser.redirect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Continue as Requester' }));
    expect(await screen.findByText('local-requester')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument();
  });

  it('shows an error when the backend rejects the selection', async () => {
    backend.validTokens.delete('demo-requester');
    renderApp(harness, '/requests', localConfig);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue as Requester' }));
    expect(
      await screen.findByText('The local demo backend did not accept the selection.'),
    ).toBeInTheDocument();
  });
});
