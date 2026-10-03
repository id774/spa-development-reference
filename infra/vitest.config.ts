// License: The GPL version 3, or LGPL version 3 (Dual License).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
  },
});
