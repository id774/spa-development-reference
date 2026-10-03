// License: The GPL version 3, or LGPL version 3 (Dual License).
import type { NestExpressApplication } from '@nestjs/platform-express';
import { composeServices } from '../../src/compose.js';
import { createApp } from '../../src/create-app.js';
import type { Persistence } from '../../src/capabilities/shared/ports.js';
import { silentLogger } from '../../src/common/logging.js';
import {
  FakeClock,
  FakeIdentityProvider,
  FakeObjectStorage,
  SequentialIds,
  administrator,
  approver,
  noRole,
  otherRequester,
  requester,
} from './fakes.js';
import { InMemoryPersistence } from './in-memory-persistence.js';

export interface TestHarness {
  app: NestExpressApplication;
  persistence: Persistence;
  identity: FakeIdentityProvider;
  storage: FakeObjectStorage;
  clock: FakeClock;
  ready: { value: boolean };
}

/** Builds the real HTTP application on top of test doubles of the ports. */
export async function createTestApp(
  persistence: Persistence = new InMemoryPersistence(),
  options: { maxBytes?: number } = {},
): Promise<TestHarness> {
  const identity = new FakeIdentityProvider();
  identity.register('tok-requester', requester, 'requester@example.com');
  identity.register('tok-other', otherRequester, 'other@example.com');
  identity.register('tok-approver', approver, 'approver@example.com');
  identity.register('tok-admin', administrator, 'admin@example.com');
  identity.register('tok-norole', noRole, 'norole@example.com');
  identity.register('tok-unverified', { subject: 'user-unverified', roles: ['Requester'] }, null);

  const storage = new FakeObjectStorage();
  const clock = new FakeClock();
  const ready = { value: true };
  const services = composeServices({
    persistence,
    identity,
    storage,
    clock,
    ids: new SequentialIds(),
    logger: silentLogger,
    routing: { requests: 'local', approvals: 'local', attachments: 'local', audit: 'local' },
    attachmentMaxBytes: options.maxBytes ?? 1024 * 1024,
    isReady: async () => ready.value,
  });
  const app = await createApp(services);
  await app.init();
  return { app, persistence, identity, storage, clock, ready };
}
