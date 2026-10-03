// License: The GPL version 3, or LGPL version 3 (Dual License).
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runWithContext } from '../src/common/context.js';
import { createLogger, describeError } from '../src/common/logging.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString('utf8'));
      callback();
    },
  });
  return {
    stream,
    records: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('structured logging', () => {
  it('writes JSON with timestamp, level, traceId, userId, operation, capability, and message', () => {
    const out = capture();
    const logger = createLogger('info', out.stream);
    runWithContext(
      {
        traceId: 'trace-1',
        userId: 'user-1',
        operation: 'GET /api/requests',
        capability: 'requests',
      },
      () => logger.warn('something recoverable', { code: 'X' }),
    );
    const [record] = out.records();
    expect(record).toMatchObject({
      level: 'warn',
      traceId: 'trace-1',
      userId: 'user-1',
      operation: 'GET /api/requests',
      capability: 'requests',
      message: 'something recoverable',
      code: 'X',
    });
    expect(new Date(record?.['timestamp'] as string).toISOString()).toBe(record?.['timestamp']);
  });

  it('distinguishes information, recoverable conditions, and failures', () => {
    const out = capture();
    const logger = createLogger('info', out.stream);
    logger.info('a');
    logger.warn('b');
    logger.error('c');
    expect(out.records().map((r) => r['level'])).toEqual(['info', 'warn', 'error']);
  });

  it('redacts tokens and secrets from structured fields', () => {
    const out = capture();
    const logger = createLogger('info', out.stream);
    logger.info('request', {
      authorization: 'Bearer abc',
      accessToken: 'abc',
      nested: { refreshToken: 'abc', password: 'abc' },
    });
    const text = JSON.stringify(out.records());
    expect(text).not.toContain('abc');
    expect(text).toContain('[redacted]');
  });

  it('removes bearer tokens and JWTs from described errors and bounds their length', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepart';
    const described = describeError(new Error(`failed with Bearer ${jwt} and ${jwt}`));
    expect(described).not.toContain('eyJ');
    expect(describeError(new Error('x'.repeat(2000))).length).toBeLessThanOrEqual(500);
  });
});
