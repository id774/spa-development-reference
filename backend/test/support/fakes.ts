// backend/test/support/fakes.ts: test support: fakes and fixed identities
//
// Description:
// Provides the deterministic clock, sequential id generator, fake object
// storage and identity provider, and the fixed identities (requester, other
// requester, approver, administrator, and a user with no role) shared by the
// backend tests. It is test support, not a test suite.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { Readable } from 'node:stream';
import type { Identity, IdentityProvider } from '../../src/capabilities/shared/identity.js';
import type { ObjectStorage } from '../../src/capabilities/shared/ports.js';
import { AppError } from '../../src/common/errors.js';
import type { Clock, IdGenerator } from '../../src/common/ports.js';

export class FakeClock implements Clock {
  constructor(private current = new Date('2026-01-01T00:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date): void {
    this.current = new Date(date);
  }
}

/** Deterministic, valid v4-shaped UUIDs. */
export class SequentialIds implements IdGenerator {
  private n = 0;
  uuid(): string {
    this.n += 1;
    return `00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`;
  }
}

export class FakeObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  failPut = false;
  failGet = false;
  failDelete = false;
  /** Runs while a put is in flight, to model a slow transfer. */
  beforePut: (() => Promise<void>) | undefined;

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.beforePut) await this.beforePut();
    if (this.failPut) throw new Error('S3 down');
    this.objects.set(key, { body, contentType });
  }
  async get(key: string) {
    if (this.failGet) throw new Error('S3 down');
    const object = this.objects.get(key);
    if (!object) throw new AppError('INTERNAL_ERROR');
    return { body: Readable.from([object.body]), contentLength: object.body.length };
  }
  async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('delete failed');
    this.objects.delete(key);
  }
}

/** Identity provider test double keyed by bearer token. */
export class FakeIdentityProvider implements IdentityProvider {
  readonly identities = new Map<string, Identity>();
  readonly emails = new Map<string, string | null>();
  userInfoUnavailable = false;
  authenticateUnavailable = false;

  register(token: string, identity: Identity, email: string | null = null): void {
    this.identities.set(token, identity);
    this.emails.set(identity.subject, email);
  }

  async authenticate(token: string): Promise<Identity> {
    if (this.authenticateUnavailable) throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE');
    const identity = this.identities.get(token);
    if (!identity) throw new AppError('AUTHENTICATION_REQUIRED');
    return identity;
  }

  async resolveVerifiedEmail(_token: string, subject: string): Promise<string | null> {
    if (this.userInfoUnavailable) throw new AppError('IDENTITY_PROVIDER_UNAVAILABLE');
    return this.emails.get(subject) ?? null;
  }
}

export const requester: Identity = { subject: 'user-requester', roles: ['Requester'] };
export const otherRequester: Identity = { subject: 'user-other', roles: ['Requester'] };
export const approver: Identity = { subject: 'user-approver', roles: ['Approver'] };
export const administrator: Identity = { subject: 'user-admin', roles: ['Administrator'] };
export const noRole: Identity = { subject: 'user-norole', roles: [] };
