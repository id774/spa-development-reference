// License: The GPL version 3, or LGPL version 3 (Dual License).
import {
  createApiClient,
  type ApiClient,
  type Session,
  type SessionRole,
} from '@spa-ref/api-client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CognitoRuntimeConfig, RuntimeConfig } from '../../app/config.js';
import {
  AuthError,
  authorizationUrl,
  exchangeCode,
  logoutUrl,
  refreshTokens,
  safeReturnPath,
  transaction,
  type TransactionStorage,
} from './oauth.js';
import { LOCAL_DEMO_TOKENS } from './local-demo.js';
import { codeChallenge, randomString } from './pkce.js';
import { TokenStore } from './token-store.js';

/** Everything the provider needs from the browser, injectable for tests. */
export interface BrowserPort {
  transactionStorage: TransactionStorage;
  redirect(url: string): void;
}

export const realBrowser: BrowserPort = {
  transactionStorage: window.sessionStorage,
  redirect: (url) => window.location.assign(url),
};

export type AuthStatus = 'signed-in' | 'signed-out';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** UI role state from GET /api/session. Presentation only; the server authorizes. */
  roles: readonly SessionRole[];
  api: ApiClient;
  /** `local` is the no-external-service demo; `cognito` is the Amazon Cognito flow. */
  authMode: RuntimeConfig['authMode'];
  /** Local demo only: continues as one of the fixed demo identities. */
  signInLocal(role: SessionRole): Promise<void>;
  signIn(returnPath?: string): Promise<void>;
  /** Completes the authorization code flow and returns the path to continue at. */
  completeSignIn(search: URLSearchParams): Promise<string>;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_MARGIN_MS = 60_000;

function requireCognito(config: RuntimeConfig): CognitoRuntimeConfig {
  if (config.authMode !== 'cognito') throw new AuthError('Cognito sign-in is not enabled.');
  return config;
}

export function AuthProvider({
  config,
  children,
  browser = realBrowser,
  fetchImpl,
  now = Date.now,
}: {
  config: RuntimeConfig;
  children: ReactNode;
  browser?: BrowserPort;
  fetchImpl?: typeof fetch;
  now?: () => number;
}) {
  const doFetch = useMemo<typeof fetch>(
    () => fetchImpl ?? ((input, init) => globalThis.fetch(input, init)),
    [fetchImpl],
  );
  const [tokens] = useState(() => new TokenStore());
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('signed-out');

  /** Discards tokens and all UI role state. */
  const clearSession = useCallback(() => {
    tokens.clear();
    setSession(null);
    setStatus('signed-out');
  }, [tokens]);

  const fetchSession = useCallback(
    async (accessToken: string): Promise<Session | null> => {
      const response = await doFetch('/api/session', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401) return null;
      if (!response.ok) throw new AuthError('The session could not be loaded.');
      return (await response.json()) as Session;
    },
    [doFetch],
  );

  /** Refreshes the access token, then re-fetches the session so the roles stay current. */
  const refresh = useCallback(async () => {
    const current = tokens.get();
    if (current?.refreshToken == null) return;
    try {
      const next = await refreshTokens(requireCognito(config), doFetch, current.refreshToken, now);
      tokens.set(next);
      const fresh = await fetchSession(next.accessToken);
      if (fresh === null) clearSession();
      else setSession(fresh);
    } catch {
      clearSession();
    }
  }, [clearSession, config, doFetch, fetchSession, now, tokens]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokens.get();
    if (current === null) return null;
    if (current.expiresAt - now() <= REFRESH_MARGIN_MS && current.refreshToken !== null) {
      tokens.refreshing ??= refresh().finally(() => {
        tokens.refreshing = null;
      });
      await tokens.refreshing;
    }
    return tokens.get()?.accessToken ?? null;
  }, [now, refresh, tokens]);

  const api = useMemo(
    () => createApiClient({ getAccessToken, onUnauthorized: clearSession, fetch: doFetch }),
    [clearSession, doFetch, getAccessToken],
  );

  const signIn = useCallback(
    async (returnPath = '/') => {
      const cognito = requireCognito(config);
      const verifier = randomString(48);
      const state = randomString(24);
      transaction.save(browser.transactionStorage, {
        verifier,
        state,
        returnPath: safeReturnPath(returnPath),
      });
      browser.redirect(
        authorizationUrl(cognito, { state, challenge: await codeChallenge(verifier) }),
      );
    },
    [browser, config],
  );

  const completeSignIn = useCallback(
    async (search: URLSearchParams): Promise<string> => {
      const cognito = requireCognito(config);
      const saved = transaction.load(browser.transactionStorage);
      // The transaction state is single use, whatever the outcome.
      transaction.clear(browser.transactionStorage);
      const code = search.get('code');
      if (search.get('error') !== null || code === null) {
        throw new AuthError('Sign-in was not completed.');
      }
      if (saved === null || search.get('state') !== saved.state) {
        throw new AuthError('The sign-in response did not match the request.');
      }
      const issued = await exchangeCode(cognito, doFetch, { code, verifier: saved.verifier }, now);
      const loaded = await fetchSession(issued.accessToken);
      if (loaded === null) throw new AuthError('The session could not be established.');
      tokens.set(issued);
      setSession(loaded);
      setStatus('signed-in');
      return safeReturnPath(saved.returnPath);
    },
    [browser, config, doFetch, fetchSession, now, tokens],
  );

  const signInLocal = useCallback(
    async (role: SessionRole) => {
      if (config.authMode !== 'local') throw new AuthError('Local sign-in is not enabled.');
      const accessToken = LOCAL_DEMO_TOKENS[role];
      const loaded = await fetchSession(accessToken);
      if (loaded === null) throw new AuthError('The session could not be established.');
      // The roles come from GET /api/session, not from the selected button.
      tokens.set({ accessToken, refreshToken: null, expiresAt: Number.MAX_SAFE_INTEGER });
      setSession(loaded);
      setStatus('signed-in');
    },
    [config, fetchSession, tokens],
  );

  const signOut = useCallback(() => {
    // State is cleared before the browser leaves for the identity provider.
    clearSession();
    if (config.authMode === 'local') return;
    transaction.clear(browser.transactionStorage);
    browser.redirect(logoutUrl(config));
  }, [browser, clearSession, config]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      roles: session?.roles ?? [],
      api,
      authMode: config.authMode,
      signInLocal,
      signIn,
      completeSignIn,
      signOut,
    }),
    [api, completeSignIn, config.authMode, session, signIn, signInLocal, signOut, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
