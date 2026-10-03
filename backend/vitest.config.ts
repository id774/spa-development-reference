// backend/vitest.config.ts: Vitest configuration of the backend workspace
//
// Description:
// Configures the backend test run: the Node environment, the test file
// patterns, timeouts, sequential file execution, and the global setup that
// prepares the test database.
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
// - Vitest

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    globalSetup: ['test/support/global-setup.ts'],
  },
});
