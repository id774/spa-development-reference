// License: The GPL version 3, or LGPL version 3 (Dual License).
import 'reflect-metadata';
import { S3Client } from '@aws-sdk/client-s3';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SNSClient } from '@aws-sdk/client-sns';
import { composeServices } from './compose.js';
import { createApp } from './create-app.js';
import { ConfigError, loadConfig } from './common/config.js';
import { createLogger, describeError } from './common/logging.js';
import { randomIds, systemClock } from './common/ports.js';
import { CognitoIdentityProvider } from './infrastructure/aws/cognito/cognito-identity-provider.js';
import { S3ObjectStorage } from './infrastructure/aws/s3/s3-object-storage.js';
import { SesMailSender } from './infrastructure/aws/ses/ses-mail-sender.js';
import { SnsEventPublisher } from './infrastructure/aws/sns/sns-event-publisher.js';
import { PrismaOutboxStore } from './infrastructure/persistence/prisma-outbox-store.js';
import { PrismaPersistence } from './infrastructure/persistence/prisma-persistence.js';
import { OutboxWorker } from './outbox/outbox-worker.js';

async function main(): Promise<void> {
  // Configuration is resolved once, here; nothing below reads the environment.
  const config = loadConfig(process.env);
  const logger = createLogger(config.logLevel);

  const persistence = new PrismaPersistence(config.database.url);
  const region = config.aws.region;
  const services = composeServices({
    persistence,
    identity: new CognitoIdentityProvider(config.cognito, logger),
    storage: new S3ObjectStorage(new S3Client({ region }), config.s3.bucket),
    clock: systemClock,
    ids: randomIds,
    logger,
    routing: config.routing,
    attachmentMaxBytes: config.attachments.maxBytes,
    isReady: () => persistence.isReady(),
  });

  const worker = new OutboxWorker(
    new PrismaOutboxStore(persistence.client),
    new SesMailSender(new SESv2Client({ region }), config.ses.sender),
    new SnsEventPublisher(new SNSClient({ region }), config.sns.topicArn),
    systemClock,
    randomIds,
    logger,
    config.outbox,
  );

  const app = await createApp(services);
  await app.listen(config.http.port, config.http.host);
  worker.start();
  logger.info('backend started', { port: config.http.port });

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
