// frontend/vite.config.ts: Vite and Vitest configuration of the frontend workspace
//
// Description:
// Configures the React plugin, the development proxy that preserves the
// production browser API path shape (/api to the local backend), and the jsdom
// test environment.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See frontend/package.json for workspace dependencies
// - Vite
// - Vitest

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Development proxy that preserves the production browser API path shape.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
