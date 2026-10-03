// License: The GPL version 3, or LGPL version 3 (Dual License).
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
