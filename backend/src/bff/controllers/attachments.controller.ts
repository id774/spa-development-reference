// backend/src/bff/controllers/attachments.controller.ts: attachment endpoint controller
//
// Description:
// Maps the attachment endpoints (list, upload, download) onto the attachments
// capability. It receives one multipart file in memory within the configured
// size limit, validates it with the domain upload rules, and streams
// downloads.
//
// Downloads always carry Content-Disposition: attachment,
// X-Content-Type-Options: nosniff, and Cache-Control: private, no-store. The
// multipart file name is display metadata only and never a storage path.
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
// - multer for multipart parsing
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../common/errors.js';
import {
  contentDisposition,
  validateUpload,
} from '../../capabilities/attachments/domain/attachment-rules.js';
import { Roles } from '../auth/guards.js';
import { APP_SERVICES, type AppServices } from '../app-services.js';
import { listBody, toAttachmentDto } from '../http/dto.js';
import { parseListQuery, parseUuid } from '../http/validation.js';
import { DISPATCHER, type CapabilityDispatcher } from '../routing/capability-dispatcher.js';

function identityOf(req: Request) {
  if (req.identity === undefined) throw new AppError('AUTHENTICATION_REQUIRED');
  return req.identity;
}

@Controller('api/requests/:requestId/attachments')
export class AttachmentsController {
  constructor(
    @Inject(DISPATCHER) private readonly capabilities: CapabilityDispatcher,
    @Inject(APP_SERVICES) private readonly services: AppServices,
  ) {}

  @Get()
  @Roles('Requester', 'Approver', 'Administrator')
  async list(@Req() req: Request, @Param('requestId') requestId: string) {
    const input = parseListQuery(req.query);
    const id = parseUuid(requestId, 'requestId');
    const page = await this.capabilities.resolve('attachments').list(identityOf(req), id, input);
    return listBody(page, toAttachmentDto);
  }

  @Post()
  @Roles('Requester')
  async upload(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('requestId') requestId: string,
  ) {
    const id = parseUuid(requestId, 'requestId');
    if (req.is('multipart/form-data') === false) {
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The request body must be multipart/form-data.');
    }
    const file = await this.receiveFile(req, res);
    if (file === undefined) throw new AppError('VALIDATION_ERROR', 'The "file" part is required.');

    const checked = validateUpload({
      fileName: file.originalname,
      declaredMediaType: file.mimetype,
      bytes: file.buffer,
    });
    if (!checked.ok) throw new AppError(checked.code, checked.detail);

    res.status(201);
    return toAttachmentDto(
      await this.capabilities.resolve('attachments').upload(identityOf(req), id, checked.upload),
    );
  }

  @Get(':attachmentId')
  @Roles('Requester', 'Approver', 'Administrator')
  async download(
    @Req() req: Request,
    @Res() res: Response,
    @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<void> {
    const rid = parseUuid(requestId, 'requestId');
    const aid = parseUuid(attachmentId, 'attachmentId');
    const { attachment, body } = await this.capabilities
      .resolve('attachments')
      .download(identityOf(req), rid, aid);
    res.status(200).set({
      'Content-Type': attachment.mediaType,
      'Content-Length': String(attachment.sizeBytes),
      'Content-Disposition': contentDisposition(attachment.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    (body as NodeJS.ReadableStream & { destroy?: (e?: Error) => void }).on('error', () =>
      res.destroy(),
    );
    body.pipe(res);
  }

  private receiveFile(req: Request, res: Response): Promise<Express.Multer.File | undefined> {
    const parser = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: this.services.attachmentMaxBytes, files: 1 },
      defParamCharset: 'utf8',
    }).single('file');
    return new Promise((resolve, reject) => {
      parser(req, res, (error?: unknown) => {
        if (!error) resolve(req.file);
        else if (error instanceof multer.MulterError) reject(error);
        else reject(new AppError('VALIDATION_ERROR', 'The multipart body could not be parsed.'));
      });
    });
  }
}
