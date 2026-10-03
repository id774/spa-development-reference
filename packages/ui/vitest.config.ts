// License: The GPL version 3, or LGPL version 3 (Dual License).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
