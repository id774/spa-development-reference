// backend/prisma.config.ts: Prisma CLI configuration
//
// Description:
// Configures the Prisma CLI (generate, validate, migrate): the schema and
// migration paths and the datasource URL, taken from DATABASE_URL or from the
// DB_* variables.
//
// A placeholder URL is used when neither is set so that generate and validate
// work without a database. Application code does not use this file; it
// receives typed configuration instead.
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
// - Prisma 7.10.0

import { defineConfig } from 'prisma/config';

const env = process.env;

// Prisma CLI configuration, used only by CLI commands (generate, validate,
// migrate). Application code receives typed configuration instead.
function databaseUrl(): string {
  if (env['DATABASE_URL']) return env['DATABASE_URL'];
  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = env;
  if (DB_HOST && DB_NAME && DB_USERNAME && DB_PASSWORD !== undefined) {
    const credentials = `${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(DB_PASSWORD)}`;
    return `postgresql://${credentials}@${DB_HOST}:${DB_PORT ?? '5432'}/${DB_NAME}`;
  }
  // Placeholder so that `generate` and `validate` work without a database.
  return 'postgresql://postgres:postgres@localhost:5432/spa_reference';
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl() },
});
