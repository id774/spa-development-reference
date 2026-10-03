// backend/test/support/global-setup.ts: test support: Vitest global setup
//
// Description:
// Applies the Prisma migrations to the disposable test database before the
// backend tests run. It is test support, not a test suite.
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
// - Prisma 7.10.0
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Applies the migrations to the disposable test database before the tests run. */
export default function setup(): void {
  const url =
    process.env['TEST_DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/spa_test';
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
