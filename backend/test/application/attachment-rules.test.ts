// backend/test/application/attachment-rules.test.ts: tests of the attachment validation rules
//
// Description:
// Pins the pure upload rules: accepted media types, content signature and
// extension agreement, empty files, file name validation, and the
// Content-Disposition fallback.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Running the tests:
//     Run the whole backend suite:
//         npm run test -w @spa-ref/backend
//
//     Run this file:
//         npm run test -w @spa-ref/backend -- test/application/attachment-rules.test.ts
//
// Test Cases:
//     - Supported media types accepted
//     - Unsupported type, signature mismatch, and extension mismatch rejected
//     - Zero-byte and invalid file names rejected
//     - Attachment-only Content-Disposition with a safe fallback
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - See backend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { describe, expect, it } from 'vitest';
import {
  contentDisposition,
  validateFileName,
  validateUpload,
} from '../../src/capabilities/attachments/domain/attachment-rules.js';

const PDF = Buffer.from('%PDF-1.7\nbody');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('x'),
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const TEXT = Buffer.from('こんにちは', 'utf8');

function check(fileName: string, declaredMediaType: string, bytes: Buffer) {
  return validateUpload({ fileName, declaredMediaType, bytes });
}

describe('attachment acceptance', () => {
  it('accepts the supported media types with matching content and extension', () => {
    expect(check('a.pdf', 'application/pdf', PDF).ok).toBe(true);
    expect(check('a.PNG', 'image/png', PNG).ok).toBe(true);
    expect(check('a.jpg', 'image/jpeg', JPEG).ok).toBe(true);
    expect(check('a.jpeg', 'IMAGE/JPEG', JPEG).ok).toBe(true);
    expect(check('a.txt', 'text/plain', TEXT).ok).toBe(true);
    expect(check('a.txt', 'text/plain; charset=utf-8', TEXT).ok).toBe(true);
  });

  it('rejects an unsupported media type', () => {
    expect(check('a.zip', 'application/zip', PDF)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(check('a.txt', 'text/plain; charset=shift_jis', TEXT)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('rejects a signature mismatch', () => {
    expect(check('a.pdf', 'application/pdf', PNG)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(check('a.png', 'image/png', JPEG)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(check('a.txt', 'text/plain', Buffer.from([0xff, 0xfe, 0x00, 0x41]))).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('rejects an extension mismatch', () => {
    expect(check('a.png', 'application/pdf', PDF)).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    expect(check('noextension', 'application/pdf', PDF)).toMatchObject({ ok: false });
  });

  it('rejects a zero-byte file as a validation error', () => {
    expect(check('a.txt', 'text/plain', Buffer.alloc(0))).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects invalid file names', () => {
    for (const name of [
      '',
      'a/b.pdf',
      'a\\b.pdf',
      'a\u0000.pdf',
      'a\r\n.pdf',
      'a\u0007.pdf',
      `${'x'.repeat(252)}.pdf`,
    ]) {
      expect(check(name, 'application/pdf', PDF), name).toMatchObject({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
    }
    expect(validateFileName('é.pdf')).toEqual({ ok: true, name: 'é.pdf' });
  });

  it('always builds an attachment Content-Disposition with a safe fallback', () => {
    const header = contentDisposition('請求書 (1).pdf');
    expect(header).toBe(
      'attachment; filename="_____1_.pdf"; filename*=UTF-8\'\'%E8%AB%8B%E6%B1%82%E6%9B%B8%20%281%29.pdf',
    );
    expect(header.startsWith('attachment;')).toBe(true);
    expect(header).not.toMatch(/[\r\n]/);
  });
});
