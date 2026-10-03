// License: The GPL version 3, or LGPL version 3 (Dual License).
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/common/config.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  COGNITO_ISSUER: 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool/',
  COGNITO_CLIENT_ID: 'client',
  COGNITO_USERINFO_ENDPOINT: 'https://auth.example.com/oauth2/userInfo',
  AWS_REGION: 'ap-northeast-1',
  S3_BUCKET: 'bucket',
  SES_SENDER: 'noreply@example.com',
  SNS_TOPIC_ARN: 'arn:aws:sns:ap-northeast-1:111111111111:topic',
};

describe('configuration', () => {
  it('resolves defaults from DETAILED_DESIGN and POLICY', () => {
    const config = loadConfig(valid);
    expect(config.attachments.maxBytes).toBe(10 * 1024 * 1024);
    expect(config.outbox).toMatchObject({
      pollIntervalMs: 5000,
      maxAttempts: 5,
      retryDelaysSeconds: [30, 120, 600, 1800],
      claimLeaseSeconds: 60,
      providerTimeoutMs: 15000,
    });
    expect(config.cognito.issuer).toBe('https://cognito-idp.ap-northeast-1.amazonaws.com/pool');
    expect(config.cognito.jwksUri).toBe(
      'https://cognito-idp.ap-northeast-1.amazonaws.com/pool/.well-known/jwks.json',
    );
    expect(config.routing).toEqual({
      requests: 'local',
      approvals: 'local',
      attachments: 'local',
      audit: 'local',
    });
  });

  it('builds the database URL from parts and encodes credentials', () => {
    const { DATABASE_URL: _ignored, ...rest } = valid;
    const config = loadConfig({
      ...rest,
      DB_HOST: 'db.internal',
      DB_NAME: 'spa',
      DB_USERNAME: 'app user',
      DB_PASSWORD: 'p@ss/word',
    });
    expect(config.database.url).toBe('postgresql://app%20user:p%40ss%2Fword@db.internal:5432/spa');
  });

  it('allows deployment overrides', () => {
    const config = loadConfig({
      ...valid,
      ATTACHMENT_MAX_BYTES: '104857600',
      OUTBOX_MAX_ATTEMPTS: '3',
      OUTBOX_RETRY_DELAYS_SECONDS: '10,20',
    });
    expect(config.attachments.maxBytes).toBe(104857600);
    expect(config.outbox.retryDelaysSeconds).toEqual([10, 20]);
  });

  const invalid: Array<[string, Record<string, string>]> = [
    ['an attachment limit above 100 MiB', { ATTACHMENT_MAX_BYTES: '104857601' }],
    ['a zero attachment limit', { ATTACHMENT_MAX_BYTES: '0' }],
    ['a non-numeric attachment limit', { ATTACHMENT_MAX_BYTES: 'big' }],
    ['a retry list that does not match the attempts', { OUTBOX_RETRY_DELAYS_SECONDS: '1,2' }],
    ['a non-numeric retry delay', { OUTBOX_RETRY_DELAYS_SECONDS: '30,x,600,1800' }],
    ['a lease shorter than the provider timeout', { OUTBOX_CLAIM_LEASE_SECONDS: '10' }],
    ['a provider timeout above 15 seconds', { OUTBOX_PROVIDER_TIMEOUT_MS: '20000' }],
    ['a remote capability', { CAPABILITY_REQUESTS_MODE: 'remote' }],
    ['a malformed issuer', { COGNITO_ISSUER: 'not a url' }],
  ];
  for (const [label, override] of invalid) {
    it(`fails bootstrap for ${label}`, () => {
      expect(() => loadConfig({ ...valid, ...override })).toThrow(ConfigError);
    });
  }

  it('fails bootstrap when required settings are missing, listing every problem', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL[\s\S]*COGNITO_ISSUER[\s\S]*S3_BUCKET/);
  });
});
