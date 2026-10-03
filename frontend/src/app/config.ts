// frontend/src/app/config.ts: browser runtime configuration
//
// Description:
// Defines and validates the browser-safe runtime configuration served as
// /config.json, for either the Cognito sign-in or the local demo. It contains
// no secret.
//
// The application does not start with an invalid configuration; the loader
// fails with a ConfigurationError instead.
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

/** Browser-safe runtime configuration served as /config.json. It contains no secret. */
export interface CognitoRuntimeConfig {
  authMode: 'cognito';
  cognito: {
    clientId: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    logoutEndpoint: string;
  };
  redirectUri: string;
  postLogoutUri: string;
}

/** Local demo: the SPA selects one of the fixed demo identities; no external IdP is used. */
export interface LocalRuntimeConfig {
  authMode: 'local';
}

export type RuntimeConfig = CognitoRuntimeConfig | LocalRuntimeConfig;

export class ConfigurationError extends Error {}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new ConfigurationError(`Missing or invalid configuration value: ${name}`);
  }
  return value;
}

function url(value: unknown, name: string): string {
  const candidate = text(value, name);
  try {
    new URL(candidate);
  } catch {
    throw new ConfigurationError(`Configuration value is not a URL: ${name}`);
  }
  return candidate;
}

/** Validates runtime configuration; the application does not start with an invalid one. */
export function parseRuntimeConfig(raw: unknown): RuntimeConfig {
  const root = (raw ?? {}) as Record<string, unknown>;
  const authMode = root['authMode'];
  if (authMode === 'local') return { authMode: 'local' };
  if (authMode !== 'cognito') {
    throw new ConfigurationError('Missing or invalid configuration value: authMode');
  }
  const cognito = (root['cognito'] ?? {}) as Record<string, unknown>;
  return {
    authMode: 'cognito',
    cognito: {
      clientId: text(cognito['clientId'], 'cognito.clientId'),
      authorizationEndpoint: url(cognito['authorizationEndpoint'], 'cognito.authorizationEndpoint'),
      tokenEndpoint: url(cognito['tokenEndpoint'], 'cognito.tokenEndpoint'),
      logoutEndpoint: url(cognito['logoutEndpoint'], 'cognito.logoutEndpoint'),
    },
    redirectUri: url(root['redirectUri'], 'redirectUri'),
    postLogoutUri: url(root['postLogoutUri'], 'postLogoutUri'),
  };
}

export async function loadRuntimeConfig(fetchImpl: typeof fetch = fetch): Promise<RuntimeConfig> {
  const response = await fetchImpl('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new ConfigurationError('The runtime configuration could not be loaded.');
  return parseRuntimeConfig(await response.json());
}
