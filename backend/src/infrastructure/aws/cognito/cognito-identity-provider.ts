// backend/src/infrastructure/aws/cognito/cognito-identity-provider.ts: Amazon Cognito identity adapter
//
// Description:
// Validates Cognito access tokens (signature through the user pool JWKS,
// issuer, token use, client, and expiry), derives the application roles from
// the cognito:groups claim, and resolves a verified email through the Cognito
// user endpoint.
//
// Cognito and HTTP types stop in this adapter. Provider failures become
// IDENTITY_PROVIDER_UNAVAILABLE and token problems become
// AUTHENTICATION_REQUIRED; tokens are never logged.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
// - jose for JWT validation
// - An Amazon Cognito user pool (aws mode only)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { createPublicKey, type KeyObject } from 'node:crypto';
import { decodeProtectedHeader, jwtVerify, type JWK } from 'jose';
import { AppError } from '../../../common/errors.js';
import { describeError, type AppLogger } from '../../../common/logging.js';
import {
  sortRoles,
  type Identity,
  type IdentityProvider,
  type Role,
} from '../../../capabilities/shared/identity.js';

export interface CognitoSettings {
  issuer: string;
  clientId: string;
  userInfoEndpoint: string;
  jwksUri: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const GROUP_ROLES: Record<string, Role> = {
  Requester: 'Requester',
  Approver: 'Approver',
  Administrator: 'Administrator',
};

const CLOCK_SKEW_SECONDS = 60;
const HTTP_TIMEOUT_MS = 5000;

/**
 * Cognito adapter: access-token validation against the user-pool JWKS and
 * verified-email lookup through the UserInfo endpoint. Cognito specifics stop
 * here; callers receive an application Identity.
 */
export class CognitoIdentityProvider implements IdentityProvider {
  private keys = new Map<string, KeyObject>();
  private refreshing: Promise<void> | undefined;

  constructor(
    private readonly settings: CognitoSettings,
    private readonly logger: AppLogger,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async authenticate(token: string): Promise<Identity> {
    const unauthenticated = (cause?: unknown) =>
      new AppError('AUTHENTICATION_REQUIRED', undefined, { cause });

    let kid: string | undefined;
    try {
      const header = decodeProtectedHeader(token);
      if (header.alg !== 'RS256') throw unauthenticated();
      kid = header.kid;
    } catch (error) {
      throw error instanceof AppError ? error : unauthenticated(error);
    }
    if (kid === undefined) throw unauthenticated();

    const key = await this.signingKey(kid);
    if (key === undefined) throw unauthenticated();

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(token, key, {
        issuer: this.settings.issuer,
        algorithms: ['RS256'],
        clockTolerance: CLOCK_SKEW_SECONDS,
      }));
    } catch (error) {
      throw unauthenticated(error);
    }

    if (payload['client_id'] !== this.settings.clientId) throw unauthenticated();
    if (payload['token_use'] !== 'access') throw unauthenticated();
    const scopes = typeof payload['scope'] === 'string' ? payload['scope'].split(' ') : [];
    if (!scopes.includes('openid') || !scopes.includes('email')) throw unauthenticated();
    if (typeof payload.sub !== 'string' || payload.sub === '') throw unauthenticated();

    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];
    const roles = sortRoles(
      groups.flatMap((group) => {
        const role = typeof group === 'string' ? GROUP_ROLES[group] : undefined;
        return role === undefined ? [] : [role];
      }),
    );
    return { subject: payload.sub, roles };
  }

  async resolveVerifiedEmail(token: string, subject: string): Promise<string | null> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.settings.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error('userinfo request failed', { error: describeError(error) });
      throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE', undefined, { cause: error });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError('AUTHENTICATION_REQUIRED');
    }
    if (!response.ok) {
      this.logger.error('userinfo request rejected', { status: response.status });
      throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE');
    }
    let profile: Record<string, unknown>;
    try {
      profile = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE', undefined, { cause: error });
    }
    const verified = profile['email_verified'] === true || profile['email_verified'] === 'true';
    const email = profile['email'];
    if (profile['sub'] !== subject || typeof email !== 'string' || email === '' || !verified) {
      return null;
    }
    return email;
  }

  /**
   * Looks up the signing key. An unknown `kid` refreshes the JWKS once. If the
   * refresh fails and the key is not cached, validation cannot proceed.
   */
  private async signingKey(kid: string): Promise<KeyObject | undefined> {
    const cached = this.keys.get(kid);
    if (cached !== undefined) return cached;
    try {
      await this.refreshKeys();
    } catch (error) {
      this.logger.error('jwks retrieval failed', { error: describeError(error) });
      throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE', undefined, { cause: error });
    }
    return this.keys.get(kid);
  }

  private refreshKeys(): Promise<void> {
    this.refreshing ??= this.fetchKeys().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  private async fetchKeys(): Promise<void> {
    const response = await this.fetchImpl(this.settings.jwksUri, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`JWKS request failed with status ${response.status}`);
    const body = (await response.json()) as { keys?: JWK[] };
    const next = new Map<string, KeyObject>();
    for (const jwk of body.keys ?? []) {
      if (jwk.kid !== undefined && jwk.kty === 'RSA') {
        next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      }
    }
    this.keys = next;
  }
}
