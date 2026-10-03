// License: The GPL version 3, or LGPL version 3 (Dual License).
import { Controller, Get, HttpCode, Inject, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../../common/errors.js';
import { Roles } from '../auth/guards.js';
import { APP_SERVICES, type AppServices } from '../app-services.js';
import { listBody, toRequestDto } from '../http/dto.js';
import {
  parseCreateBody,
  parseDecisionBody,
  parseListQuery,
  parseUpdateBody,
  parseUuid,
  parseVersionBody,
  readJsonBody,
} from '../http/validation.js';
import { DISPATCHER, type CapabilityDispatcher } from '../routing/capability-dispatcher.js';

function identityOf(req: Request) {
  if (req.identity === undefined) throw new AppError('AUTHENTICATION_REQUIRED');
  return req.identity;
}

@Controller('api')
export class RequestsController {
  constructor(
    @Inject(DISPATCHER) private readonly capabilities: CapabilityDispatcher,
    @Inject(APP_SERVICES) private readonly services: AppServices,
  ) {}

  @Get('requests')
  @Roles('Requester', 'Administrator')
  async list(@Req() req: Request) {
    const input = parseListQuery(req.query);
    const page = await this.capabilities.resolve('requests').list(identityOf(req), input);
    return listBody(page, toRequestDto);
  }

  @Post('requests')
  @HttpCode(201)
  @Roles('Requester')
  async create(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = parseCreateBody(await readJsonBody(req, res));
    const identity = identityOf(req);
    // Identity enrichment: a verified email is required to create a request.
    const email = await this.services.identity.resolveVerifiedEmail(
      req.accessToken as string,
      identity.subject,
    );
    if (email === null) {
      throw new AppError('FORBIDDEN', 'A verified email address is required to create a request.');
    }
    return toRequestDto(await this.capabilities.resolve('requests').create(identity, input, email));
  }

  @Get('requests/:requestId')
  @Roles('Requester', 'Approver', 'Administrator')
  async get(@Req() req: Request, @Param('requestId') requestId: string) {
    const id = parseUuid(requestId, 'requestId');
    return toRequestDto(await this.capabilities.resolve('requests').get(identityOf(req), id));
  }

  @Put('requests/:requestId')
  @Roles('Requester')
  async update(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('requestId') requestId: string,
  ) {
    const body = parseUpdateBody(await readJsonBody(req, res));
    const id = parseUuid(requestId, 'requestId');
    return toRequestDto(
      await this.capabilities.resolve('requests').updateDraft(identityOf(req), id, body),
    );
  }

  @Post('requests/:requestId/submit')
  @HttpCode(200)
  @Roles('Requester')
  async submit(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('requestId') requestId: string,
  ) {
    const body = parseVersionBody(await readJsonBody(req, res));
    const id = parseUuid(requestId, 'requestId');
    return toRequestDto(
      await this.capabilities.resolve('requests').submit(identityOf(req), id, body.version),
    );
  }

  @Post('requests/:requestId/approve')
  @HttpCode(200)
  @Roles('Approver')
  async approve(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('requestId') requestId: string,
  ) {
    const body = parseDecisionBody(await readJsonBody(req, res));
    const id = parseUuid(requestId, 'requestId');
    return toRequestDto(
      await this.capabilities.resolve('approvals').approve(identityOf(req), id, body),
    );
  }

  @Post('requests/:requestId/reject')
  @HttpCode(200)
  @Roles('Approver')
  async reject(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('requestId') requestId: string,
  ) {
    const body = parseDecisionBody(await readJsonBody(req, res));
    const id = parseUuid(requestId, 'requestId');
    return toRequestDto(
      await this.capabilities.resolve('approvals').reject(identityOf(req), id, body),
    );
  }

  @Get('approvals')
  @Roles('Approver')
  async approvals(@Req() req: Request) {
    const input = parseListQuery(req.query);
    const page = await this.capabilities.resolve('approvals').queue(identityOf(req), input);
    return listBody(page, toRequestDto);
  }
}
