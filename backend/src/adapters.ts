// backend/src/adapters.ts: runtime-mode selection of infrastructure adapters
//
// Description:
// The single place that selects the infrastructure adapters by runtime mode.
// In local mode it returns the file-system and recorder adapters; in aws mode
// it creates the AWS SDK clients and returns the Cognito, S3, SES, and SNS
// adapters.
//
// Application and domain code never look at the mode, and AWS SDK clients are
// created in aws mode only.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
// - AWS SDK for JavaScript v3 clients (S3, SES v2, SNS), used in aws mode only
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

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
