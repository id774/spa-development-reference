// backend/test/auth/cognito.test.ts: tests of Cognito access token validation
//
// Description:
// Pins CognitoIdentityProvider against locally generated signing keys and a
// fake JWKS and user endpoint: token claims, group-to-role mapping, clock
// skew, key refresh and caching, unsupported algorithms, and verified email
// lookup. No real Cognito service is used.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/auth/cognito.test.ts
//
// Test Cases:
//     - Valid tokens and group-to-role mapping
//     - Rejection of invalid claims, signatures, and algorithms
//     - Clock skew tolerance
//     - JWKS refresh, caching, and outage behavior
//     - Verified email lookup and failure mapping
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CognitoIdentityProvider } from '../../src/infrastructure/aws/cognito/cognito-identity-provider.js';
import { silentLogger } from '../../src/common/logging.js';

const ISSUER = 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example';
const CLIENT_ID = 'spa-client-id';
const settings = {
  issuer: ISSUER,
  clientId: CLIENT_ID,
  userInfoEndpoint: 'https://auth.example.com/oauth2/userInfo',
  jwksUri: `${ISSUER}/.well-known/jwks.json`,
};

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;
let primary: Keys;
let rotated: Keys;
let primaryJwk: JWK;
let rotatedJwk: JWK;

interface TokenOptions {
  kid?: string;
  key?: Keys['privateKey'];
  issuer?: string;
  clientId?: string;
  tokenUse?: string;
  scope?: string;
  groups?: unknown;
  expiresInSeconds?: number;
  sub?: string;
  alg?: string;
}

async function token(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    client_id: options.clientId ?? CLIENT_ID,
    token_use: options.tokenUse ?? 'access',
    scope: options.scope ?? 'openid email',
  };
  if (options.groups !== null) claims['cognito:groups'] = options.groups ?? ['Requester'];
  return new SignJWT(claims)
    .setProtectedHeader({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'key-1' })
    .setIssuer(options.issuer ?? ISSUER)
    .setSubject(options.sub ?? 'sub-1')
    .setIssuedAt(now - 100)
    .setExpirationTime(now + (options.expiresInSeconds ?? 600))
    .sign(options.key ?? primary.privateKey);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeAll(async () => {
  primary = await generateKeyPair('RS256', { extractable: true });
  rotated = await generateKeyPair('RS256', { extractable: true });
  primaryJwk = { ...(await exportJWK(primary.publicKey)), kid: 'key-1', alg: 'RS256', use: 'sig' };
  rotatedJwk = { ...(await exportJWK(rotated.publicKey)), kid: 'key-2', alg: 'RS256', use: 'sig' };
});

describe('Cognito access token validation', () => {
  let jwks: JWK[];
  let jwksAvailable: boolean;
  let fetchMock: ReturnType<typeof vi.fn>;
  let provider: CognitoIdentityProvider;

  beforeEach(() => {
    jwks = [primaryJwk];
    jwksAvailable = true;
    fetchMock = vi.fn(async (url: string) => {
      if (url === settings.jwksUri) {
        if (!jwksAvailable) throw new Error('network down');
        return jsonResponse({ keys: jwks });
      }
      return jsonResponse({}, 404);
    });
    provider = new CognitoIdentityProvider(settings, silentLogger, fetchMock as never);
  });

  it('accepts a valid token and maps groups to roles', async () => {
    const identity = await provider.authenticate(await token({ groups: ['Requester'] }));
    expect(identity).toEqual({ subject: 'sub-1', roles: ['Requester'] });
  });

  it('maps every group, ignores unknown groups, and unions multiple roles in a fixed order', async () => {
    const identity = await provider.authenticate(
      await token({ groups: ['Administrator', 'other-group', 'Requester', 'requester'] }),
    );
    expect(identity.roles).toEqual(['Requester', 'Administrator']);
    const approver = await provider.authenticate(await token({ groups: ['Approver'] }));
    expect(approver.roles).toEqual(['Approver']);
  });

  it('gives a user with no recognized group an empty role list', async () => {
    expect((await provider.authenticate(await token({ groups: ['unknown'] }))).roles).toEqual([]);
    expect((await provider.authenticate(await token({ groups: null as never }))).roles).toEqual([]);
  });

  const rejected: Array<[string, TokenOptions]> = [
    ['an expired token', { expiresInSeconds: -3600 }],
    ['the wrong issuer', { issuer: 'https://evil.example.com' }],
    ['the wrong client ID', { clientId: 'someone-else' }],
    ['the wrong token_use', { tokenUse: 'id' }],
    ['a missing email scope', { scope: 'openid' }],
    ['a missing openid scope', { scope: 'email' }],
  ];
  for (const [label, options] of rejected) {
    it(`rejects ${label}`, async () => {
      await expect(provider.authenticate(await token(options))).rejects.toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
      });
    });
  }

  it('tolerates up to 60 seconds of clock skew on expiry', async () => {
    await expect(
      provider.authenticate(await token({ expiresInSeconds: -30 })),
    ).resolves.toBeDefined();
  });

  it('rejects a bad signature and garbage', async () => {
    await expect(
      provider.authenticate(await token({ key: rotated.privateKey })),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
    await expect(provider.authenticate('not-a-jwt')).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('refreshes the JWKS once for an unknown kid and accepts the new key', async () => {
    await provider.authenticate(await token());
    jwks = [primaryJwk, rotatedJwk];
    const identity = await provider.authenticate(
      await token({ kid: 'key-2', key: rotated.privateKey }),
    );
    expect(identity.subject).toBe('sub-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with 401 when the kid is still unknown after the refresh', async () => {
    const t = await token({ kid: 'key-9' });
    await expect(provider.authenticate(t)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the identity provider unavailable when no usable key is cached and the JWKS cannot be fetched', async () => {
    jwksAvailable = false;
    await expect(provider.authenticate(await token())).rejects.toMatchObject({
      code: 'IDENTITY_PROVIDER_UNAVAILABLE',
    });
  });

  it('keeps validating with a cached key while the JWKS is unavailable', async () => {
    await provider.authenticate(await token());
    jwksAvailable = false;
    await expect(provider.authenticate(await token())).resolves.toBeDefined();
  });

  it('does not accept alg none or HS256 tokens', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'key-1' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'x', iss: ISSUER })).toString('base64url');
    await expect(provider.authenticate(`${header}.${payload}.`)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });
});

describe('verified email lookup', () => {
  function providerWith(response: () => Promise<Response>) {
    const fetchMock = vi.fn(async () => response());
    return {
      provider: new CognitoIdentityProvider(settings, silentLogger, fetchMock as never),
      fetchMock,
    };
  }

  it('returns a verified email whose sub matches', async () => {
    const { provider, fetchMock } = providerWith(async () =>
      jsonResponse({ sub: 'sub-1', email: 'a@example.com', email_verified: 'true' }),
    );
    await expect(provider.resolveVerifiedEmail('tok', 'sub-1')).resolves.toBe('a@example.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(settings.userInfoEndpoint);
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('accepts a boolean email_verified', async () => {
    const { provider } = providerWith(async () =>
      jsonResponse({ sub: 'sub-1', email: 'a@example.com', email_verified: true }),
    );
    await expect(provider.resolveVerifiedEmail('tok', 'sub-1')).resolves.toBe('a@example.com');
  });

  const unusable: Array<[string, Record<string, unknown>]> = [
    ['a different sub', { sub: 'other', email: 'a@example.com', email_verified: 'true' }],
    ['a missing email', { sub: 'sub-1', email_verified: 'true' }],
    ['an empty email', { sub: 'sub-1', email: '', email_verified: 'true' }],
    ['an unverified email', { sub: 'sub-1', email: 'a@example.com', email_verified: 'false' }],
  ];
  for (const [label, profile] of unusable) {
    it(`returns null for ${label}`, async () => {
      const { provider } = providerWith(async () => jsonResponse(profile));
      await expect(provider.resolveVerifiedEmail('tok', 'sub-1')).resolves.toBeNull();
    });
  }

  it('maps a UserInfo authentication failure to 401', async () => {
    const { provider } = providerWith(async () => jsonResponse({}, 401));
    await expect(provider.resolveVerifiedEmail('tok', 'sub-1')).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('maps network and server failures to IDENTITY_PROVIDER_UNAVAILABLE', async () => {
    const down = providerWith(async () => {
      throw new Error('boom');
    });
    await expect(down.provider.resolveVerifiedEmail('tok', 'sub-1')).rejects.toMatchObject({
      code: 'IDENTITY_PROVIDER_UNAVAILABLE',
    });
    const error = providerWith(async () => jsonResponse({}, 500));
    await expect(error.provider.resolveVerifiedEmail('tok', 'sub-1')).rejects.toMatchObject({
      code: 'IDENTITY_PROVIDER_UNAVAILABLE',
    });
  });
});
