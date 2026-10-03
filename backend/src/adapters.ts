// License: The GPL version 3, or LGPL version 3 (Dual License).
import { S3Client } from '@aws-sdk/client-s3';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SNSClient } from '@aws-sdk/client-sns';
import type { IdentityProvider } from './capabilities/shared/identity.js';
import type { ObjectStorage } from './capabilities/shared/ports.js';
import type { AppConfig } from './common/config.js';
import type { AppLogger } from './common/logging.js';
import { CognitoIdentityProvider } from './infrastructure/aws/cognito/cognito-identity-provider.js';
import { S3ObjectStorage } from './infrastructure/aws/s3/s3-object-storage.js';
import { SesMailSender } from './infrastructure/aws/ses/ses-mail-sender.js';
import { SnsEventPublisher } from './infrastructure/aws/sns/sns-event-publisher.js';
import {
  LocalEventPublisher,
  LocalMailSender,
} from './infrastructure/local/local-delivery-recorders.js';
import { LocalIdentityProvider } from './infrastructure/local/local-identity-provider.js';
import { LocalObjectStorage } from './infrastructure/local/local-object-storage.js';
import type { EventPublisher, MailSender } from './outbox/ports.js';

export interface ExternalAdapters {
  identity: IdentityProvider;
  storage: ObjectStorage;
  mail: MailSender;
  events: EventPublisher;
}

/**
 * The only place that selects infrastructure adapters by runtime mode.
 * Application and domain code never look at the mode. AWS SDK clients are
 * created in the aws mode only.
 */
export function createAdapters(config: AppConfig, logger: AppLogger): ExternalAdapters {
  if (config.mode === 'local') {
    const dataDir = config.local.dataDir;
    return {
      identity: new LocalIdentityProvider(),
      storage: new LocalObjectStorage(dataDir),
      mail: new LocalMailSender(dataDir),
      events: new LocalEventPublisher(dataDir),
    };
  }
  const region = config.aws.region;
  return {
    identity: new CognitoIdentityProvider(config.cognito, logger),
    storage: new S3ObjectStorage(new S3Client({ region }), config.s3.bucket),
    mail: new SesMailSender(new SESv2Client({ region }), config.ses.sender),
    events: new SnsEventPublisher(new SNSClient({ region }), config.sns.topicArn),
  };
}
