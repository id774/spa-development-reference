// backend/test/support/db.ts: test support: test database access
//
// Description:
// Opens the disposable test database named by TEST_DATABASE_URL and resets its
// tables between tests. It is test support, not a test suite.
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
// - A PostgreSQL-compatible test database (TEST_DATABASE_URL, default postgresql://postgres:postgres@localhost:5432/spa_test)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { PrismaPersistence } from '../../src/infrastructure/persistence/prisma-persistence.js';
import { PrismaOutboxStore } from '../../src/infrastructure/persistence/prisma-outbox-store.js';

export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/spa_test';

export function openDatabase() {
  const persistence = new PrismaPersistence(TEST_DATABASE_URL);
  return { persistence, outbox: new PrismaOutboxStore(persistence.client) };
}

/** Empties every table between tests. */
export async function resetDatabase(persistence: PrismaPersistence): Promise<void> {
  await persistence.client.$executeRawUnsafe(
    'TRUNCATE TABLE outbox_deliveries, audit_events, attachments, approvals, requests CASCADE',
  );
}
