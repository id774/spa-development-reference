// infra/vitest.config.ts: Vitest configuration of the infrastructure workspace
//
// Description:
// Configures the infrastructure test run: the test file pattern and a timeout
// that allows template synthesis.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - AWS CDK v2
// - See infra/package.json for workspace dependencies
// - Vitest

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
  },
});
