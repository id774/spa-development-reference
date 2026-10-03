// License: The GPL version 3, or LGPL version 3 (Dual License).
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
