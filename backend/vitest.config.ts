// License: The GPL version 3, or LGPL version 3 (Dual License).
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
