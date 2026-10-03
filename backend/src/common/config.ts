// License: The GPL version 3, or LGPL version 3 (Dual License).
import { z } from 'zod';

export const CAPABILITY_NAMES = ['requests', 'approvals', 'attachments', 'audit'] as const;
export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

export interface AppConfig {
  http: { host: string; port: number };
  logLevel: string;
  database: { url: string };
  cognito: {
    issuer: string;
    clientId: string;
    userInfoEndpoint: string;
    jwksUri: string;
  };
  aws: { region: string };
  s3: { bucket: string };
  ses: { sender: string };
  sns: { topicArn: string };
  attachments: { maxBytes: number };
  outbox: {
    pollIntervalMs: number;
    maxAttempts: number;
    retryDelaysSeconds: number[];
    claimLeaseSeconds: number;
    providerTimeoutMs: number;
    batchSize: number;
  };
  /** Capability routing, resolved once at startup and immutable afterwards. */
  routing: Readonly<Record<CapabilityName, 'local'>>;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

const MIB = 1024 * 1024;
const DEFAULT_RETRY_DELAYS = [30, 120, 600, 1800];

const url = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .url({ error: `${name} must be a URL` })
    .transform((value) => value.replace(/\/+$/, ''));

const positiveInt = (name: string, fallback: number, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return fallback;
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
        ctx.addIssue({
          code: 'custom',
          message: `${name} must be an integer between 1 and ${max}`,
        });
        return z.NEVER;
      }
      return Number(value);
    });

const required = (name: string) =>
  z.string({ error: `${name} is required` }).min(1, { error: `${name} is required` });

function buildDatabaseUrl(env: Env): string | undefined {
  if (env['DATABASE_URL']) return env['DATABASE_URL'];
  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = env;
  if (!DB_HOST || !DB_NAME || !DB_USERNAME || DB_PASSWORD === undefined) return undefined;
  const credentials = `${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(DB_PASSWORD)}`;
  return `postgresql://${credentials}@${DB_HOST}:${DB_PORT ?? '5432'}/${DB_NAME}`;
}

function parseRetryDelays(value: string | undefined): number[] | null {
  if (value === undefined || value === '') return DEFAULT_RETRY_DELAYS;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.some((part) => !/^\d+$/.test(part) || Number(part) < 1)) return null;
  return parts.map(Number);
}

/**
 * Resolves and validates all configuration. Invalid or missing required values
 * fail bootstrap; nothing is silently normalized or defaulted around a
 * required capability.
 */
export function loadConfig(env: Env): AppConfig {
  const problems: string[] = [];
  const collect = <T>(schema: z.ZodType<T>, value: unknown, label: string): T | undefined => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    for (const issue of result.error.issues) problems.push(issue.message || label);
    return undefined;
  };

  const port = collect(positiveInt('PORT', 3000, 65535), env['PORT'], 'PORT');
  const maxBytes = collect(
    positiveInt('ATTACHMENT_MAX_BYTES', 10 * MIB, 100 * MIB),
    env['ATTACHMENT_MAX_BYTES'],
    'ATTACHMENT_MAX_BYTES',
  );
  const pollIntervalMs = collect(
    positiveInt('OUTBOX_POLL_INTERVAL_MS', 5000),
    env['OUTBOX_POLL_INTERVAL_MS'],
    'OUTBOX_POLL_INTERVAL_MS',
  );
  const maxAttempts = collect(
    positiveInt('OUTBOX_MAX_ATTEMPTS', 5, 20),
    env['OUTBOX_MAX_ATTEMPTS'],
    'OUTBOX_MAX_ATTEMPTS',
  );
  const claimLeaseSeconds = collect(
    positiveInt('OUTBOX_CLAIM_LEASE_SECONDS', 60),
    env['OUTBOX_CLAIM_LEASE_SECONDS'],
    'OUTBOX_CLAIM_LEASE_SECONDS',
  );
  const providerTimeoutMs = collect(
    positiveInt('OUTBOX_PROVIDER_TIMEOUT_MS', 15000, 15000),
    env['OUTBOX_PROVIDER_TIMEOUT_MS'],
    'OUTBOX_PROVIDER_TIMEOUT_MS',
  );
  const batchSize = collect(
    positiveInt('OUTBOX_BATCH_SIZE', 10, 100),
    env['OUTBOX_BATCH_SIZE'],
    'OUTBOX_BATCH_SIZE',
  );
  const retryDelaysSeconds = parseRetryDelays(env['OUTBOX_RETRY_DELAYS_SECONDS']);
  if (retryDelaysSeconds === null) {
    problems.push(
      'OUTBOX_RETRY_DELAYS_SECONDS must be a comma separated list of positive integers',
    );
  } else if (maxAttempts !== undefined && retryDelaysSeconds.length !== maxAttempts - 1) {
    problems.push(
      'OUTBOX_RETRY_DELAYS_SECONDS must contain exactly OUTBOX_MAX_ATTEMPTS - 1 delay values',
    );
  }
  if (
    providerTimeoutMs !== undefined &&
    claimLeaseSeconds !== undefined &&
    providerTimeoutMs >= claimLeaseSeconds * 1000
  ) {
    problems.push('OUTBOX_CLAIM_LEASE_SECONDS must be longer than OUTBOX_PROVIDER_TIMEOUT_MS');
  }

  const databaseUrl = collect(
    required('DATABASE_URL or DB_* settings'),
    buildDatabaseUrl(env),
    'db',
  );
  const issuer = collect(url('COGNITO_ISSUER'), env['COGNITO_ISSUER'], 'COGNITO_ISSUER');
  const clientId = collect(required('COGNITO_CLIENT_ID'), env['COGNITO_CLIENT_ID'], 'client');
  const userInfoEndpoint = collect(
    url('COGNITO_USERINFO_ENDPOINT'),
    env['COGNITO_USERINFO_ENDPOINT'],
    'userinfo',
  );
  const region = collect(required('AWS_REGION'), env['AWS_REGION'], 'region');
  const bucket = collect(required('S3_BUCKET'), env['S3_BUCKET'], 'bucket');
  const sender = collect(required('SES_SENDER'), env['SES_SENDER'], 'sender');
  const topicArn = collect(required('SNS_TOPIC_ARN'), env['SNS_TOPIC_ARN'], 'topic');

  for (const name of CAPABILITY_NAMES) {
    const mode = env[`CAPABILITY_${name.toUpperCase()}_MODE`] ?? 'local';
    if (mode !== 'local') {
      problems.push(
        `CAPABILITY_${name.toUpperCase()}_MODE must be "local"; remote capabilities are not part of the current implementation`,
      );
    }
  }

  if (problems.length > 0) {
    throw new ConfigError(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  }

  return {
    http: { host: env['HOST'] ?? '0.0.0.0', port: port as number },
    logLevel: env['LOG_LEVEL'] ?? 'info',
    database: { url: databaseUrl as string },
    cognito: {
      issuer: issuer as string,
      clientId: clientId as string,
      userInfoEndpoint: userInfoEndpoint as string,
      jwksUri: `${issuer as string}/.well-known/jwks.json`,
    },
    aws: { region: region as string },
    s3: { bucket: bucket as string },
    ses: { sender: sender as string },
    sns: { topicArn: topicArn as string },
    attachments: { maxBytes: maxBytes as number },
    outbox: {
      pollIntervalMs: pollIntervalMs as number,
      maxAttempts: maxAttempts as number,
      retryDelaysSeconds: retryDelaysSeconds as number[],
      claimLeaseSeconds: claimLeaseSeconds as number,
      providerTimeoutMs: providerTimeoutMs as number,
      batchSize: batchSize as number,
    },
    routing: { requests: 'local', approvals: 'local', attachments: 'local', audit: 'local' },
  };
}
