// License: The GPL version 3, or LGPL version 3 (Dual License).
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
