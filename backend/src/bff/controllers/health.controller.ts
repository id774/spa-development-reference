// backend/src/bff/controllers/health.controller.ts: liveness and readiness endpoints
//
// Description:
// Serves the operational endpoints outside the business API contract.
// /health/live reports process liveness only. /health/ready reports whether
// the database is reachable and answers 503 when it is not.
//
// Both are public and call no external provider beyond the database.
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

import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/guards.js';
import { APP_SERVICES, type AppServices } from '../app-services.js';

/** Operational endpoints outside the business API contract. */
@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(APP_SERVICES) private readonly services: AppServices) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const ready = await this.services.isReady();
    if (!ready) res.status(503);
    return { status: ready ? 'ok' : 'not_ready' };
  }
}
