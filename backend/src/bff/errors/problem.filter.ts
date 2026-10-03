// backend/src/bff/errors/problem.filter.ts: global exception filter
//
// Description:
// Catches every exception raised inside NestJS handlers and guards and answers
// it through the shared Problem Details writer, so that no failure leaves in a
// framework-specific shape.
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

import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_SERVICES, type AppServices } from '../app-services.js';
import { sendProblem } from './problem.js';

/** Global filter: every failure leaves as a Problem Details response. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(@Inject(APP_SERVICES) private readonly services: AppServices) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    sendProblem(
      http.getRequest<Request>(),
      http.getResponse<Response>(),
      exception,
      this.services.logger,
    );
  }
}
