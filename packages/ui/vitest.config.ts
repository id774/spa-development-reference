// packages/ui/vitest.config.ts: Vitest configuration of the UI workspace
//
// Description:
// Configures the jsdom test environment and the setup file for the component
// tests.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See packages/ui/package.json for workspace dependencies
// - Vitest

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
