// backend/src/infrastructure/local/local-object-storage.ts: local demo object storage adapter
//
// Description:
// Stores attachment content on the local file system under the configured data
// directory (local demo mode only), using the same
// attachments/<requestId>/<attachmentId> keys as S3.
//
// Every key is validated and resolved under the storage root, and anything
// that could leave that root is refused.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AppError } from '../../common/errors.js';
import type { ObjectStorage } from '../../capabilities/shared/ports.js';

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Stores attachment content on the local file system (local demo mode only).
 * Keys are the same `attachments/<requestId>/<attachmentId>` keys that S3 uses.
 */
export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(dataDir: string) {
    this.root = resolve(dataDir, 'attachments');
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string) {
    const path = this.pathFor(key);
    try {
      const { size } = await stat(path);
      return { body: createReadStream(path) as NodeJS.ReadableStream, contentLength: size };
    } catch (error) {
      // Metadata exists but the object does not: an inconsistency, as with S3.
      throw new AppError('INTERNAL_ERROR', undefined, { cause: error });
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  /** Maps a key to a file under the storage root and refuses anything that could leave it. */
  private pathFor(key: string): string {
    const segments = key.split('/');
    const expected = segments.length === 3 && segments[0] === 'attachments';
    if (
      !expected ||
      !segments.every((segment) => SAFE_SEGMENT.test(segment) && !segment.includes('..'))
    ) {
      throw new Error('invalid object key');
    }
    const path = resolve(this.root, ...segments.slice(1));
    if (!path.startsWith(this.root + sep)) throw new Error('invalid object key');
    return path;
  }
}
