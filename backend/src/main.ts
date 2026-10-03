// backend/src/main.ts: backend process entry point
//
// Description:
// Starts the backend process. It resolves configuration once from the process
// environment, builds the logger, persistence, infrastructure adapters, and
// capability services, creates the NestJS application, starts the outbox
// worker, and handles SIGTERM and SIGINT by stopping the worker, the HTTP
// server, and the database connection in that order.
//
// The only runtime mode switch (local or aws) is applied here through
// createAdapters; nothing below this file reads the environment. Invalid
// required configuration is a startup failure that writes a message to
// standard error and exits with status 1. Configuration names and defaults are
// documented in doc/CONFIGURATION.md.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Build / Run:
//     npm run dev -w @spa-ref/backend
//     npm run build -w @spa-ref/backend
//     npm run start -w @spa-ref/backend
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
// - A reachable PostgreSQL-compatible database (see doc/CONFIGURATION.md)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import 'reflect-metadata';
import { createAdapters } from './adapters.js';
import { composeServices } from './compose.js';
import { createApp } from './create-app.js';
import { ConfigError, loadConfig } from './common/config.js';
import { createLogger, describeError } from './common/logging.js';
import { randomIds, systemClock } from './common/ports.js';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox-store.js';
import { PrismaPersistence } from './infrastructure/persistence/prisma-persistence.js';
import { OutboxWorker } from './outbox/outbox-worker.js';

async function main(): Promise<void> {
  // Configuration is resolved once, here; nothing below reads the environment.
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);

  const persistence = new PrismaPersistence(config.database.url);
  // The only mode switch: it selects the infrastructure adapters.
  const adapters = createAdapters(config, logger);
  const services = composeServices({
    persistence,
    identity: adapters.identity,
    storage: adapters.storage,
    clock: systemClock,
    ids: randomIds,
    logger,
    routing: config.routing,
    attachmentMaxBytes: config.attachments.maxBytes,
    isReady: () => persistence.isReady(),
  });

  const worker = new OutboxWorker(
    new PrismaOutboxStore(persistence.client),
    adapters.mail,
    adapters.events,
    systemClock,
    randomIds,
    logger,
    config.outbox,
  );

  const app = await createApp(services);
  await app.listen(config.http.port, config.http.host);
  worker.start();
  if (config.mode === 'local') {
    logger.warn(
      'local demo mode: demo bearer tokens are accepted and nothing leaves this machine; never expose this process',
      { dataDir: config.local.dataDir },
    );
  }
  logger.info('backend started', { port: config.http.port, mode: config.mode });

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('shutting down', { signal });
    try {
      await worker.stop();
      await app.close();
      await persistence.close();
    } catch (error) {
      logger.error('shutdown failed', { error: describeError(error) });
      process.exitCode = 1;
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // Invalid required configuration is a startup failure.
  const message = error instanceof ConfigError ? error.message : describeError(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
