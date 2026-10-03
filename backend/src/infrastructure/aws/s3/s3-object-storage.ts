// backend/src/infrastructure/aws/s3/s3-object-storage.ts: Amazon S3 object storage adapter
//
// Description:
// Implements the object-storage port with Amazon S3. SDK types stop here, and
// storage failures are translated into application errors without exposing
// provider messages.
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
// - @aws-sdk/client-s3
// - An S3 bucket (aws mode only)
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { AppError } from '../../../common/errors.js';
import type { ObjectStorage } from '../../../capabilities/shared/ports.js';

/** S3 adapter. SDK types stop here; failures become application errors. */
export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        ServerSideEncryption: 'AES256',
      }),
      { abortSignal: AbortSignal.timeout(30_000) },
    );
  }

  async get(key: string) {
    try {
      const output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(30_000) },
      );
      if (!(output.Body instanceof Readable)) throw new Error('unexpected S3 body type');
      return { body: output.Body as NodeJS.ReadableStream, contentLength: output.ContentLength };
    } catch (error) {
      // Metadata exists but the object does not: an inconsistency, not an outage.
      if (error instanceof NoSuchKey)
        throw new AppError('INTERNAL_ERROR', undefined, { cause: error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(15_000),
    });
  }
}
