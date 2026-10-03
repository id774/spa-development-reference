// License: The GPL version 3, or LGPL version 3 (Dual License).
import { pino } from 'pino';
import { currentContext } from './context.js';

/** Structured logger used by application and infrastructure code. */
export interface AppLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const REDACTED_PATHS = [
  'authorization',
  'accessToken',
  'refreshToken',
  'idToken',
  'token',
  'password',
  'secret',
  'clientSecret',
  'privateKey',
  '*.authorization',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
  '*.password',
  '*.secret',
];

/** Creates the JSON logger. Fields: timestamp, level, traceId, userId, operation, capability, message. */
export function createLogger(level: string, destination?: NodeJS.WritableStream): AppLogger {
  const logger = pino(
    {
      level,
      base: null,
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      mixin() {
        const context = currentContext();
        return context
          ? {
              traceId: context.traceId,
              userId: context.userId,
              operation: context.operation,
              capability: context.capability,
            }
          : {};
      },
    },
    destination ?? process.stdout,
  );
  return {
    info: (message, fields) => logger.info(fields ?? {}, message),
    warn: (message, fields) => logger.warn(fields ?? {}, message),
    error: (message, fields) => logger.error(fields ?? {}, message),
  };
}

export const silentLogger: AppLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Reduces an unknown error to a bounded, secret-free diagnostic string. */
export function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${message}`
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, '[redacted-token]')
    .slice(0, 500);
}
