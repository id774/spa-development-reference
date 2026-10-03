// backend/src/bff/controllers/audit.controller.ts: administrative audit endpoint controller
//
// Description:
// Serves GET /api/admin/audit, restricted to the Administrator role, with
// optional filtering by request identifier and keyset pagination.
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

import { Controller, Get, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../../common/errors.js';
import { Roles } from '../auth/guards.js';
import { listBody, toAuditDto } from '../http/dto.js';
import { parseListQuery, parseUuid } from '../http/validation.js';
import { DISPATCHER, type CapabilityDispatcher } from '../routing/capability-dispatcher.js';

@Controller('api/admin')
export class AuditController {
  constructor(@Inject(DISPATCHER) private readonly capabilities: CapabilityDispatcher) {}

  @Get('audit')
  @Roles('Administrator')
  async list(@Req() req: Request) {
    const input = parseListQuery(req.query);
    const rawRequestId = req.query['requestId'];
    if (rawRequestId !== undefined && typeof rawRequestId !== 'string') {
      throw new AppError('VALIDATION_ERROR', 'requestId must be a UUID.');
    }
    const requestId = rawRequestId === undefined ? undefined : parseUuid(rawRequestId, 'requestId');
    if (req.identity === undefined) throw new AppError('AUTHENTICATION_REQUIRED');
    const page = await this.capabilities
      .resolve('audit')
      .list(req.identity, { ...input, requestId });
    return listBody(page, toAuditDto);
  }
}
