// License: The GPL version 3, or LGPL version 3 (Dual License).
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
