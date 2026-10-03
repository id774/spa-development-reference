// License: The GPL version 3, or LGPL version 3 (Dual License).

export const ACCEPTED_MEDIA_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;
export type AcceptedMediaType = (typeof ACCEPTED_MEDIA_TYPES)[number];

const EXTENSIONS: Record<AcceptedMediaType, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
};

export interface UploadCandidate {
  fileName: string;
  declaredMediaType: string;
  bytes: Buffer;
}

export interface ValidUpload {
  fileName: string;
  mediaType: AcceptedMediaType;
  bytes: Buffer;
}

export type UploadValidation =
  | { ok: true; upload: ValidUpload }
  | { ok: false; code: 'VALIDATION_ERROR' | 'UNSUPPORTED_MEDIA_TYPE'; detail: string };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(bytes: Buffer, prefix: Buffer): boolean {
  return bytes.length >= prefix.length && bytes.subarray(0, prefix.length).equals(prefix);
}

function isValidUtf8Text(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function contentMatches(mediaType: AcceptedMediaType, bytes: Buffer): boolean {
  switch (mediaType) {
    case 'application/pdf':
      return startsWith(bytes, Buffer.from('%PDF-', 'latin1'));
    case 'image/png':
      return startsWith(bytes, PNG_SIGNATURE);
    case 'image/jpeg':
      return startsWith(bytes, Buffer.from([0xff, 0xd8, 0xff]));
    case 'text/plain':
      return isValidUtf8Text(bytes);
  }
}

/** Returns the normalized media type, or null when it is not accepted. */
export function normalizeMediaType(declared: string): AcceptedMediaType | null {
  const [essence = '', ...parameters] = declared.split(';').map((part) => part.trim());
  const type = essence.toLowerCase();
  if (!(ACCEPTED_MEDIA_TYPES as readonly string[]).includes(type)) return null;
  const mediaType = type as AcceptedMediaType;
  if (mediaType === 'text/plain') {
    for (const parameter of parameters) {
      const [name = '', value = ''] = parameter.split('=').map((part) => part.trim());
      if (name.toLowerCase() === 'charset' && value.replace(/"/g, '').toLowerCase() !== 'utf-8') {
        return null;
      }
    }
  }
  return mediaType;
}

/** The multipart file name is display metadata only; it is never a storage path. */
export function validateFileName(raw: string): { ok: true; name: string } | { ok: false } {
  const name = raw.normalize('NFC');
  if (name.length === 0 || name.length > 255) return { ok: false };
  // eslint-disable-next-line no-control-regex
  if (/[/\\\u0000-\u001f\u007f]/.test(name)) return { ok: false };
  return { ok: true, name };
}

/**
 * Validates an upload: file name, declared media type, extension, and content
 * signature. The size limit is enforced while the body is received.
 */
export function validateUpload(candidate: UploadCandidate): UploadValidation {
  const name = validateFileName(candidate.fileName);
  if (!name.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', detail: 'The file name is not acceptable.' };
  }
  if (candidate.bytes.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', detail: 'The file is empty.' };
  }
  const mediaType = normalizeMediaType(candidate.declaredMediaType);
  if (mediaType === null) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      detail: 'The media type of the file is not supported.',
    };
  }
  const lower = name.name.toLowerCase();
  if (!EXTENSIONS[mediaType].some((extension) => lower.endsWith(extension))) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      detail: 'The file name extension does not match the media type.',
    };
  }
  if (!contentMatches(mediaType, candidate.bytes)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      detail: 'The file content does not match the declared media type.',
    };
  }
  return { ok: true, upload: { fileName: name.name, mediaType, bytes: candidate.bytes } };
}

/** Builds a Content-Disposition value that is always `attachment`. */
export function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
