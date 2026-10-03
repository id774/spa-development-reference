// License: The GPL version 3, or LGPL version 3 (Dual License).

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
