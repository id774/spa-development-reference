// License: The GPL version 3, or LGPL version 3 (Dual License).
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
