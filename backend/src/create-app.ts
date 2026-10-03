// backend/src/create-app.ts: NestJS application factory
//
// Description:
// Creates the NestJS Express application for the given AppServices. Body
// parsing is deliberately left to the handlers so that authentication and role
// checks run before any request body is read.
//
// It installs the request-context middleware and the route table, disables the
// X-Powered-By header, and adds a final error handler so that errors raised by
// the middleware also leave as Problem Details responses.
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
// - NestJS 11 with the Express platform adapter
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import type { AppServices } from './bff/app-services.js';
import { contextMiddleware } from './bff/context/context-middleware.js';
import { sendProblem } from './bff/errors/problem.js';
import { routeTable } from './bff/routing/route-table.js';

/**
 * Creates the NestJS application. Body parsing is deliberately left to the
 * handlers so that authentication and role checks run before any body is read.
 */
export async function createApp(services: AppServices): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(services), {
    bodyParser: false,
    logger: false,
  });
  app.disable('x-powered-by');
  app.use(contextMiddleware(services.logger));
  app.use(routeTable);
  // Errors raised by the middleware above leave as Problem responses too.
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    sendProblem(req, res, error, services.logger);
  });
  return app;
}
