// backend/test/support/contract.ts: test support: OpenAPI contract assertions
//
// Description:
// Loads openapi/openapi.yaml and provides expectContract, which asserts that a
// response is documented for its operation and matches the response schema.
// This ties the HTTP tests to the normative contract. It is test support, not
// a test suite.
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
// - ajv
// - yaml
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { expect } from 'vitest';

interface OpenApiDocument {
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> };
}

const document = parse(
  readFileSync(new URL('../../../openapi/openapi.yaml', import.meta.url), 'utf8'),
) as OpenApiDocument;

const ajv = new Ajv2020.default({ strict: false, allErrors: true });
addFormats.default(ajv);
const rewrite = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value).replaceAll('"#/components', '"openapi#/components'));
ajv.addSchema({ $id: 'openapi', components: rewrite(document.components) as object });

function resolveResponse(response: unknown): {
  content?: Record<string, { schema?: unknown }>;
} {
  const ref = (response as { $ref?: string }).$ref;
  if (ref === undefined) return response as never;
  const name = ref.split('/').at(-1) as string;
  return document.components.responses[name] as never;
}

/** Asserts that a response is documented for the operation and matches its schema. */
export function expectContract(
  method: string,
  pathTemplate: string,
  res: { status: number; headers: Record<string, string>; body: unknown },
): void {
  const operation = document.paths[pathTemplate]?.[method.toLowerCase()];
  expect(operation, `${method} ${pathTemplate} is in OpenAPI`).toBeDefined();
  const documented = operation?.responses[String(res.status)];
  expect(
    documented,
    `status ${res.status} is documented for ${method} ${pathTemplate}`,
  ).toBeDefined();
  const response = resolveResponse(documented);
  const contentType = (res.headers['content-type'] ?? '').split(';')[0] as string;
  if (response.content === undefined) return;
  const media = response.content[contentType];
  expect(media, `content type ${contentType} is documented`).toBeDefined();
  const schema = media?.schema;
  if (schema === undefined || contentType === 'application/octet-stream') return;
  if (media && 'schema' in media && (schema as { format?: string }).format === 'binary') return;
  const validate = ajv.compile(rewrite(schema) as object);
  const valid = validate(res.body);
  expect(valid, JSON.stringify(validate.errors)).toBe(true);
}

export const operations = document.paths;
