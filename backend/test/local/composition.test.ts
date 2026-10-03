// backend/test/local/composition.test.ts: tests of adapter selection by runtime mode
//
// Description:
// Pins createAdapters: local mode selects only local adapters and creates no
// AWS SDK client, aws mode selects only AWS adapters, and the default mode is
// aws.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/local/composition.test.ts
//
// Test Cases:
//     - Local adapters only in local mode
//     - AWS adapters in aws mode
//     - aws as the default mode
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { afterEach, describe, expect, it, vi } from 'vitest';

const constructed: string[] = [];
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    S3Client: class {
      constructor() {
        constructed.push('S3Client');
      }
    },
  };
});
vi.mock('@aws-sdk/client-sesv2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-sesv2')>();
  return {
    ...actual,
    SESv2Client: class {
      constructor() {
        constructed.push('SESv2Client');
      }
    },
  };
});
vi.mock('@aws-sdk/client-sns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-sns')>();
  return {
    ...actual,
    SNSClient: class {
      constructor() {
        constructed.push('SNSClient');
      }
    },
  };
});

import { createAdapters } from '../../src/adapters.js';
import { loadConfig } from '../../src/common/config.js';
import { silentLogger } from '../../src/common/logging.js';
import { CognitoIdentityProvider } from '../../src/infrastructure/aws/cognito/cognito-identity-provider.js';
import { S3ObjectStorage } from '../../src/infrastructure/aws/s3/s3-object-storage.js';
import { SesMailSender } from '../../src/infrastructure/aws/ses/ses-mail-sender.js';
import { SnsEventPublisher } from '../../src/infrastructure/aws/sns/sns-event-publisher.js';
import {
  LocalEventPublisher,
  LocalMailSender,
} from '../../src/infrastructure/local/local-delivery-recorders.js';
import { LocalIdentityProvider } from '../../src/infrastructure/local/local-identity-provider.js';
import { LocalObjectStorage } from '../../src/infrastructure/local/local-object-storage.js';

const aws = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  COGNITO_ISSUER: 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool',
  COGNITO_CLIENT_ID: 'client',
  COGNITO_USERINFO_ENDPOINT: 'https://auth.example.com/oauth2/userInfo',
  AWS_REGION: 'ap-northeast-1',
  S3_BUCKET: 'bucket',
  SES_SENDER: 'noreply@example.com',
  SNS_TOPIC_ARN: 'arn:aws:sns:ap-northeast-1:111111111111:topic',
};

afterEach(() => {
  constructed.length = 0;
});

describe('adapter selection by runtime mode', () => {
  it('local mode selects only local adapters and creates no AWS SDK client', () => {
    const adapters = createAdapters(
      loadConfig({ APP_MODE: 'local', LOCAL_DATA_DIR: '/tmp/unused' }),
      silentLogger,
    );
    expect(adapters.identity).toBeInstanceOf(LocalIdentityProvider);
    expect(adapters.storage).toBeInstanceOf(LocalObjectStorage);
    expect(adapters.mail).toBeInstanceOf(LocalMailSender);
    expect(adapters.events).toBeInstanceOf(LocalEventPublisher);
    expect(constructed).toEqual([]);
  });

  it('aws mode selects only AWS adapters', () => {
    const adapters = createAdapters(loadConfig({ ...aws, APP_MODE: 'aws' }), silentLogger);
    expect(adapters.identity).toBeInstanceOf(CognitoIdentityProvider);
    expect(adapters.storage).toBeInstanceOf(S3ObjectStorage);
    expect(adapters.mail).toBeInstanceOf(SesMailSender);
    expect(adapters.events).toBeInstanceOf(SnsEventPublisher);
    expect(constructed.sort()).toEqual(['S3Client', 'SESv2Client', 'SNSClient']);
  });

  it('the default mode is aws', () => {
    const adapters = createAdapters(loadConfig(aws), silentLogger);
    expect(adapters.identity).toBeInstanceOf(CognitoIdentityProvider);
    expect(adapters.identity).not.toBeInstanceOf(LocalIdentityProvider);
  });
});
