// backend/test/local/local-adapters.test.ts: tests of the local demo adapters
//
// Description:
// Pins the local demo adapters: the three fixed demo identities, the rejection
// of demo tokens by the AWS identity path, the file-system object storage with
// its path-traversal refusals, and the NDJSON delivery recorders.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/local/local-adapters.test.ts
//
// Test Cases:
//     - Demo token to identity mapping
//     - Demo tokens rejected on the AWS identity path
//     - Local object storage and unsafe key refusal
//     - Email and event delivery records
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_IDENTITIES,
  LocalIdentityProvider,
} from '../../src/infrastructure/local/local-identity-provider.js';
import { LocalObjectStorage } from '../../src/infrastructure/local/local-object-storage.js';
import {
  LocalEventPublisher,
  LocalMailSender,
} from '../../src/infrastructure/local/local-delivery-recorders.js';
import { CognitoIdentityProvider } from '../../src/infrastructure/aws/cognito/cognito-identity-provider.js';
import { silentLogger } from '../../src/common/logging.js';

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

describe('LocalIdentityProvider', () => {
  const provider = new LocalIdentityProvider();

  it('maps the three demo tokens to the fixed identities and roles', async () => {
    await expect(provider.authenticate('demo-requester')).resolves.toEqual({
      subject: 'local-requester',
      roles: ['Requester'],
    });
    await expect(provider.authenticate('demo-approver')).resolves.toEqual({
      subject: 'local-approver',
      roles: ['Approver'],
    });
    await expect(provider.authenticate('demo-administrator')).resolves.toEqual({
      subject: 'local-administrator',
      roles: ['Administrator'],
    });
    expect(Object.keys(DEMO_IDENTITIES)).toHaveLength(3);
  });

  it('rejects every other token with the usual authentication failure', async () => {
    for (const token of [
      '',
      'demo-other',
      'DEMO-REQUESTER',
      'demo-requester ',
      '__proto__',
      'constructor',
      'toString',
    ]) {
      await expect(provider.authenticate(token), token).rejects.toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
      });
    }
  });

  it('resolves the verified email of the token subject', async () => {
    await expect(provider.resolveVerifiedEmail('demo-requester', 'local-requester')).resolves.toBe(
      'requester@example.test',
    );
    await expect(provider.resolveVerifiedEmail('demo-approver', 'local-approver')).resolves.toBe(
      'approver@example.test',
    );
    await expect(
      provider.resolveVerifiedEmail('demo-requester', 'local-approver'),
    ).resolves.toBeNull();
    await expect(provider.resolveVerifiedEmail('unknown', 'local-requester')).resolves.toBeNull();
  });
});

describe('AWS identity path rejects the demo tokens', () => {
  it('does not accept a demo token', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
    const cognito = new CognitoIdentityProvider(
      {
        issuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool',
        clientId: 'client',
        userInfoEndpoint: 'https://auth.example.com/oauth2/userInfo',
        jwksUri: 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool/.well-known/jwks.json',
      },
      silentLogger,
      fetchMock as never,
    );
    for (const token of Object.keys(DEMO_IDENTITIES)) {
      await expect(cognito.authenticate(token)).rejects.toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('local file-based adapters', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'spa-ref-local-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const key =
    'attachments/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002';

  describe('LocalObjectStorage', () => {
    it('puts, gets, and deletes an object, creating directories as needed', async () => {
      const storage = new LocalObjectStorage(dir);
      await storage.put(key, Buffer.from('hello'), 'text/plain');
      const object = await storage.get(key);
      expect(object.contentLength).toBe(5);
      expect((await readAll(object.body)).toString()).toBe('hello');
      await storage.delete(key);
      await expect(storage.get(key)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
      await expect(storage.delete(key)).resolves.toBeUndefined(); // deleting twice is fine
    });

    it('stores under <dataDir>/attachments', async () => {
      await new LocalObjectStorage(dir).put(key, Buffer.from('x'), 'text/plain');
      const path = join(
        dir,
        'attachments',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      );
      expect((await stat(path)).isFile()).toBe(true);
    });

    it('refuses unsafe keys and path traversal', async () => {
      const storage = new LocalObjectStorage(dir);
      const bad = [
        '../escape',
        'attachments/../../escape',
        'attachments/a/../../../escape',
        '/etc/passwd',
        'attachments//x',
        'attachments/a',
        'attachments/a/b/c',
        'other/a/b',
        'attachments/a/..',
        'attachments/a\\b/c',
        'attachments/a/b\u0000',
        'attachments/./b',
        '',
      ];
      for (const candidate of bad) {
        await expect(
          storage.put(candidate, Buffer.from('x'), 'text/plain'),
          candidate,
        ).rejects.toThrow('invalid object key');
        await expect(storage.get(candidate), candidate).rejects.toThrow();
        await expect(storage.delete(candidate), candidate).rejects.toThrow('invalid object key');
      }
    });
  });

  describe('delivery recorders', () => {
    it('records an email as one NDJSON line', async () => {
      await new LocalMailSender(dir).send({
        to: 'a@example.test',
        subject: 'Request submitted',
        text: 'body\nline',
      });
      await new LocalMailSender(dir).send({ to: 'b@example.test', subject: 'S2', text: 't2' });
      const lines = (await readFile(join(dir, 'deliveries', 'email.ndjson'), 'utf8'))
        .trim()
        .split('\n');
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0] as string);
      expect(first).toMatchObject({
        to: 'a@example.test',
        subject: 'Request submitted',
        text: 'body\nline',
      });
      expect(new Date(first.timestamp).toISOString()).toBe(first.timestamp);
    });

    it('records an event with its parsed JSON body', async () => {
      await new LocalEventPublisher(dir).publish({
        eventType: 'REQUEST_APPROVED',
        body: JSON.stringify({ requestId: 'r1', version: 3 }),
      });
      await new LocalEventPublisher(dir).publish({ eventType: 'X', body: 'not json' });
      const lines = (await readFile(join(dir, 'deliveries', 'events.ndjson'), 'utf8'))
        .trim()
        .split('\n');
      expect(JSON.parse(lines[0] as string)).toMatchObject({
        eventType: 'REQUEST_APPROVED',
        body: { requestId: 'r1', version: 3 },
      });
      expect(JSON.parse(lines[1] as string)).toMatchObject({ eventType: 'X', body: 'not json' });
    });
  });
});
