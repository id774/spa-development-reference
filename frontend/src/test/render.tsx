// frontend/src/test/render.tsx: test support: application render harness
//
// Description:
// Creates the test harness (browser port, memory storage, configuration) and
// renders the application at a path. It can sign in through the real callback
// flow. It is test support, not a test suite.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from '../app/App.js';
import type { CognitoRuntimeConfig, RuntimeConfig } from '../app/config.js';
import { AuthProvider, type BrowserPort } from '../shared/auth/AuthProvider.js';
import type { FakeBackend } from './fake-backend.js';

export const config: CognitoRuntimeConfig = {
  authMode: 'cognito',
  cognito: {
    clientId: 'client-1',
    authorizationEndpoint: 'https://auth.example.com/oauth2/authorize',
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    logoutEndpoint: 'https://auth.example.com/logout',
  },
  redirectUri: 'https://app.example.com/auth/callback',
  postLogoutUri: 'https://app.example.com/signed-out',
};

export class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  get size() {
    return this.values.size;
  }
}

export interface Harness {
  backend: FakeBackend;
  browser: BrowserPort & {
    redirect: ReturnType<typeof vi.fn<(url: string) => void>>;
    transactionStorage: MemoryStorage;
  };
  clock: { now: number };
}

export function createHarness(backend: FakeBackend): Harness {
  return {
    backend,
    browser: { transactionStorage: new MemoryStorage(), redirect: vi.fn<(url: string) => void>() },
    clock: { now: 1_700_000_000_000 },
  };
}

export const localConfig: RuntimeConfig = { authMode: 'local' };

export function renderApp(harness: Harness, path: string, appConfig: RuntimeConfig = config) {
  return render(
    <AuthProvider
      config={appConfig}
      browser={harness.browser}
      fetchImpl={harness.backend.fetch as typeof fetch}
      now={() => harness.clock.now}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );
}

/** Signs in through the real callback flow and lands on `returnPath`. */
export async function signIn(harness: Harness, returnPath = '/') {
  harness.browser.transactionStorage.setItem(
    'auth.transaction',
    JSON.stringify({ verifier: 'verifier-1', state: 'state-1', returnPath }),
  );
  const rendered = renderApp(harness, '/auth/callback?code=code-1&state=state-1');
  await screen.findByRole('navigation', { name: 'Main' }).catch(() => undefined);
  return rendered;
}
