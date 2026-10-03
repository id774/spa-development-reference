// License: The GPL version 3, or LGPL version 3 (Dual License).
import express from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors.js';
import { DEFAULT_LIMIT, MAX_LIMIT, type ListInput } from '../../common/cursor.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (detail: string) => new AppError('VALIDATION_ERROR', detail);

export function parseUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw invalid(`${name} must be a UUID.`);
  }
  return value.toLowerCase();
}

/** `limit` (1..100, default 50) and `cursor` (non-empty opaque string). */
export function parseListQuery(query: Request['query']): ListInput {
  const { limit, cursor } = query;
  let parsedLimit = DEFAULT_LIMIT;
  if (limit !== undefined) {
    if (typeof limit !== 'string' || !/^\d+$/.test(limit))
      throw invalid('limit must be an integer.');
    parsedLimit = Number(limit);
    if (parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
      throw invalid(`limit must be between 1 and ${MAX_LIMIT}.`);
    }
  }
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor === '')) {
    throw invalid('cursor must be a non-empty string.');
  }
  return { limit: parsedLimit, ...(cursor === undefined ? {} : { cursor: cursor as string }) };
}

/**
 * Reads a JSON body only after authentication and role checks have passed, so
 * that an unauthenticated caller always receives 401 first.
 */
export async function readJsonBody(req: Request, res: Response): Promise<unknown> {
  if (req.is('application/json') === false) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The request body must be application/json.');
  }
  await new Promise<void>((resolve, reject) => {
    express.json({ limit: '1mb', strict: true })(req, res, (error?: unknown) =>
      error === undefined ? resolve() : reject(error),
    );
  });
  return req.body ?? {};
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join('.') ?? '';
  throw invalid(field === '' ? 'The request body is invalid.' : `The field "${field}" is invalid.`);
}

const title = z.string().trim().min(1).max(200);
const description = z
  .string()
  .transform((value) => value.replace(/\r\n/g, '\n'))
  .pipe(z.string().max(5000));
const version = z.number().int().min(1);
const comment = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => (value === '' ? null : value))
  .optional()
  .transform((value) => value ?? null);

const createSchema = z.strictObject({ title, description });
const updateSchema = z.strictObject({ title, description, version });
const versionSchema = z.strictObject({ version });
const decisionSchema = z.strictObject({ version, comment });

export const parseCreateBody = (body: unknown) => parseBody(createSchema, body);
export const parseUpdateBody = (body: unknown) => parseBody(updateSchema, body);
export const parseVersionBody = (body: unknown) => parseBody(versionSchema, body);
export const parseDecisionBody = (body: unknown) => parseBody(decisionSchema, body);
