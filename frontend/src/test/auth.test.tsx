// frontend/src/test/auth.test.tsx: tests of sign-in, sign-out, and role-aware presentation
//
// Description:
// Pins the authentication behavior of the SPA against the fake backend:
// Authorization Code with PKCE, callback state validation, no token in browser
// storage, the open-redirect guard, sign-out and 401 handling, role-aware
// presentation without decoding tokens, and token refresh.
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
//         npm run test -w @spa-ref/frontend -- src/test/auth.test.tsx
//
// Test Cases:
//     - PKCE sign-in and callback validation
//     - No tokens in browser storage; open-redirect guard
//     - Sign-out and 401 handling
//     - Roles from the session API only; presentation gates
//     - Token refresh and failure
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
import { FakeBackend } from './fake-backend.js';
import { createHarness, renderApp, signIn, type Harness } from './render.js';

let backend: FakeBackend;
let harness: Harness;

beforeEach(() => {
  backend = new FakeBackend();
  harness = createHarness(backend);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('sign-in and sign-out', () => {
  it('starts Authorization Code with PKCE (S256, openid email) and keeps only the transaction in storage', async () => {
    renderApp(harness, '/requests');
    expect(await screen.findByRole('heading', { name: 'You are signed out' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(harness.browser.redirect).toHaveBeenCalledOnce());
    const url = new URL(harness.browser.redirect.mock.calls[0]?.[0] as string);
    expect(url.origin + url.pathname).toBe('https://auth.example.com/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/auth/callback');
    const saved = JSON.parse(
      harness.browser.transactionStorage.getItem('auth.transaction') ?? '{}',
    );
    expect(saved.state).toBe(url.searchParams.get('state'));
    expect(saved.returnPath).toBe('/requests');
    expect(saved.verifier).not.toBe(url.searchParams.get('code_challenge'));
  });

  it('completes the callback: validates state, exchanges the code with the verifier, loads the session, and returns to the requested path', async () => {
    backend.seedRequest({ title: 'Visible' });
    await signIn(harness, '/requests');
    expect(await screen.findByRole('heading', { name: 'My Requests' })).toBeInTheDocument();
    expect(screen.getByText('Visible')).toBeInTheDocument();
    const grant = backend.tokenGrants[0];
    expect(grant?.get('grant_type')).toBe('authorization_code');
    expect(grant?.get('code')).toBe('code-1');
    expect(grant?.get('code_verifier')).toBe('verifier-1');
    expect(grant?.get('redirect_uri')).toBe('https://app.example.com/auth/callback');
    // Transaction state is single use and no token is stored in any browser storage.
    expect(harness.browser.transactionStorage.size).toBe(0);
    for (const storage of [window.localStorage, window.sessionStorage]) {
      expect(JSON.stringify({ ...storage })).not.toContain('access-');
      expect(JSON.stringify({ ...storage })).not.toContain('refresh-');
    }
  });

  it('rejects a callback whose state does not match, without calling the token endpoint', async () => {
    harness.browser.transactionStorage.setItem(
      'auth.transaction',
      JSON.stringify({ verifier: 'v', state: 'expected', returnPath: '/' }),
    );
    renderApp(harness, '/auth/callback?code=code-1&state=forged');
    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument();
    expect(backend.tokenGrants).toHaveLength(0);
    expect(harness.browser.transactionStorage.size).toBe(0);
  });

  it('rejects a callback without a stored transaction and a failed token exchange', async () => {
    renderApp(harness, '/auth/callback?code=code-1&state=anything');
    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument();
    expect(backend.tokenGrants).toHaveLength(0);
  });

  it('shows the failure when the token exchange is rejected', async () => {
    harness.browser.transactionStorage.setItem(
      'auth.transaction',
      JSON.stringify({ verifier: 'v', state: 's', returnPath: '/' }),
    );
    renderApp(harness, '/auth/callback?code=bad&state=s');
    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument();
    expect(backend.calls).not.toContain('GET /api/session');
  });

  it('does not follow an open-redirect return path', async () => {
    await signIn(harness, '//evil.example.com');
    expect(await screen.findByRole('heading', { name: 'My Requests' })).toBeInTheDocument();
  });

  it('sends a reload without tokens to the signed-out screen for every protected route', async () => {
    for (const path of ['/', '/requests', '/requests/new', '/approvals', '/admin/audit']) {
      const { unmount } = renderApp(harness, path);
      expect(
        await screen.findByRole('heading', { name: 'You are signed out' }),
      ).toBeInTheDocument();
      unmount();
    }
    expect(backend.calls).toHaveLength(0);
  });

  it('clears the session before leaving for the identity provider on sign-out', async () => {
    await signIn(harness);
    await screen.findByRole('heading', { name: 'My Requests' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(harness.browser.redirect).toHaveBeenCalledOnce();
    const url = new URL(harness.browser.redirect.mock.calls[0]?.[0] as string);
    expect(url.origin + url.pathname).toBe('https://auth.example.com/logout');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('logout_uri')).toBe('https://app.example.com/signed-out');
    // The UI role state is gone: the signed-out screen is shown and stays signed out.
    expect(await screen.findByRole('heading', { name: 'You are signed out' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('clears the session after a 401 from the BFF and shows the signed-out screen', async () => {
    await signIn(harness, '/requests');
    await screen.findByRole('heading', { name: 'My Requests' });
    backend.invalidateAllTokens();
    await userEvent.click(screen.getByRole('link', { name: 'Create Request' }));
    await userEvent.type(await screen.findByLabelText('Title'), 'Anything');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByRole('heading', { name: 'You are signed out' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('role-aware presentation', () => {
  it.each([
    [['Requester'], ['My Requests'], ['Approval Queue', 'Audit', 'All Requests']],
    [['Approver'], ['Approval Queue'], ['My Requests', 'Audit', 'All Requests']],
    [['Administrator'], ['All Requests', 'Audit'], ['My Requests', 'Approval Queue']],
    [
      ['Requester', 'Approver', 'Administrator'],
      ['My Requests', 'Approval Queue', 'Audit'],
      ['All Requests'],
    ],
  ] as const)(
    'shows the navigation for %j from GET /api/session',
    async (roles, visible, hidden) => {
      backend.roles = [...roles];
      await signIn(harness);
      const nav = await screen.findByRole('navigation', { name: 'Main' });
      for (const label of visible) expect(nav).toHaveTextContent(label);
      for (const label of hidden) expect(nav).not.toHaveTextContent(label);
      expect(backend.calls).toContain('GET /api/session');
    },
  );

  it('presents a user without any role with an explanation and no navigation', async () => {
    backend.roles = [];
    await signIn(harness);
    expect(await screen.findByText(/no application role/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Requests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Approval Queue' })).not.toBeInTheDocument();
  });

  it('gates routes by presentation only: a Requester cannot open the audit page', async () => {
    await signIn(harness, '/admin/audit');
    expect(await screen.findByText('You do not have access to this page.')).toBeInTheDocument();
    expect(backend.calls).not.toContain('GET /api/admin/audit');
  });

  it('does not decode the access token to decide roles', async () => {
    // The fake access token is not a JWT; roles can only have come from the session API.
    backend.roles = ['Approver'];
    await signIn(harness);
    expect(await screen.findByRole('link', { name: 'Approval Queue' })).toBeInTheDocument();
  });
});

describe('token refresh', () => {
  it('refreshes before expiry and recomputes the roles from GET /api/session', async () => {
    backend.rolesAfterRefresh = ['Requester', 'Approver'];
    await signIn(harness, '/requests');
    await screen.findByRole('heading', { name: 'My Requests' });
    expect(screen.queryByRole('link', { name: 'Approval Queue' })).not.toBeInTheDocument();

    harness.clock.now += 3600 * 1000; // the access token is about to expire
    const sessionCalls = backend.calls.filter((c) => c === 'GET /api/session').length;
    await userEvent.click(screen.getByRole('link', { name: 'Create Request' }));
    await userEvent.type(await screen.findByLabelText('Title'), 'After refresh');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(await screen.findByRole('link', { name: 'Approval Queue' })).toBeInTheDocument();
    expect(backend.tokenGrants.map((g) => g.get('grant_type'))).toEqual([
      'authorization_code',
      'refresh_token',
    ]);
    expect(backend.tokenGrants[1]?.get('refresh_token')).toBe('refresh-1');
    expect(backend.calls.filter((c) => c === 'GET /api/session').length).toBe(sessionCalls + 1);
  });

  it('discards the session and the roles when the refresh fails', async () => {
    backend.failRefresh = true;
    await signIn(harness, '/requests');
    await screen.findByRole('heading', { name: 'My Requests' });
    harness.clock.now += 3600 * 1000;
    await userEvent.click(screen.getByRole('link', { name: 'Create Request' }));
    await userEvent.type(await screen.findByLabelText('Title'), 'Doomed');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByRole('heading', { name: 'You are signed out' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(backend.requests).toHaveLength(0);
  });
});
