// License: The GPL version 3, or LGPL version 3 (Dual License).
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Development proxy that preserves the production browser API path shape.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
