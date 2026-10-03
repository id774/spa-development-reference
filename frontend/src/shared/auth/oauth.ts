// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { CognitoRuntimeConfig } from '../../app/config.js';
import type { Tokens } from './token-store.js';

export class AuthError extends Error {}

export interface AuthTransaction {
  verifier: string;
  state: string;
  returnPath: string;
}

const TRANSACTION_KEY = 'auth.transaction';

export interface TransactionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Only the authentication-transaction values (PKCE verifier, state, return
 * path) survive the full-page redirect, in sessionStorage. They are not tokens.
 */
export const transaction = {
  save(storage: TransactionStorage, value: AuthTransaction): void {
    storage.setItem(TRANSACTION_KEY, JSON.stringify(value));
  },
  load(storage: TransactionStorage): AuthTransaction | null {
    const raw = storage.getItem(TRANSACTION_KEY);
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw) as Partial<AuthTransaction>;
      if (
        typeof value.verifier === 'string' &&
        typeof value.state === 'string' &&
        typeof value.returnPath === 'string'
      ) {
        return value as AuthTransaction;
      }
    } catch {
      // fall through
    }
    return null;
  },
  clear(storage: TransactionStorage): void {
    storage.removeItem(TRANSACTION_KEY);
  },
};

export function authorizationUrl(
  config: CognitoRuntimeConfig,
  params: { state: string; challenge: string },
): string {
  const url = new URL(config.cognito.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.cognito.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function logoutUrl(config: CognitoRuntimeConfig): string {
  const url = new URL(config.cognito.logoutEndpoint);
  url.searchParams.set('client_id', config.cognito.clientId);
  url.searchParams.set('logout_uri', config.postLogoutUri);
  return url.toString();
}

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
}

async function requestTokens(
  config: CognitoRuntimeConfig,
  fetchImpl: typeof fetch,
  body: URLSearchParams,
  now: () => number,
  previousRefreshToken: string | null,
): Promise<Tokens> {
  const response = await fetchImpl(config.cognito.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new AuthError('The token request was rejected.');
  const json = (await response.json()) as TokenResponse;
  if (typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
    throw new AuthError('The token response is invalid.');
  }
  return {
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === 'string' ? json.refresh_token : previousRefreshToken,
    expiresAt: now() + json.expires_in * 1000,
  };
}

export function exchangeCode(
  config: CognitoRuntimeConfig,
  fetchImpl: typeof fetch,
  params: { code: string; verifier: string },
  now: () => number,
): Promise<Tokens> {
  return requestTokens(
    config,
    fetchImpl,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.cognito.clientId,
      code: params.code,
      redirect_uri: config.redirectUri,
      code_verifier: params.verifier,
    }),
    now,
    null,
  );
}

export function refreshTokens(
  config: CognitoRuntimeConfig,
  fetchImpl: typeof fetch,
  refreshToken: string,
  now: () => number,
): Promise<Tokens> {
  return requestTokens(
    config,
    fetchImpl,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.cognito.clientId,
      refresh_token: refreshToken,
    }),
    now,
    refreshToken,
  );
}

/** Only same-origin absolute paths are accepted as a return path. */
export function safeReturnPath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/';
}
