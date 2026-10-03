// frontend/src/shared/auth/token-store.ts: in-memory token store
//
// Description:
// Holds the access and refresh tokens in browser memory only. They are never
// written to localStorage, sessionStorage, IndexedDB, or a cookie, so a page
// reload loses them by design.
//
// It also carries the single in-flight refresh so that concurrent requests
// share one token request.
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

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/**
 * Tokens live in this object only, that is, in browser memory. They are never
 * written to localStorage, sessionStorage, IndexedDB, or a cookie, so a page
 * reload loses them by design.
 */
export class TokenStore {
  private tokens: Tokens | null = null;
  /** The single in-flight refresh, so concurrent requests share one token request. */
  refreshing: Promise<void> | null = null;

  get(): Tokens | null {
    return this.tokens;
  }

  set(tokens: Tokens): void {
    this.tokens = tokens;
  }

  clear(): void {
    this.tokens = null;
  }
}
