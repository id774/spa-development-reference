// backend/src/app.module.ts: NestJS root module of the BFF
//
// Description:
// Declares the controllers and global providers of the backend. The composed
// AppServices and the capability dispatcher are provided as values, so the
// module holds no business logic.
//
// Guards are registered in order: authentication first, then the coarse role
// check. The Problem Details filter is registered globally so that every
// failure leaves in the same shape.
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
// - NestJS 11
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard, RolesGuard } from './bff/auth/guards.js';
import { APP_SERVICES, type AppServices } from './bff/app-services.js';
import { AttachmentsController } from './bff/controllers/attachments.controller.js';
import { AuditController } from './bff/controllers/audit.controller.js';
import { HealthController } from './bff/controllers/health.controller.js';
import { RequestsController } from './bff/controllers/requests.controller.js';
import { SessionController } from './bff/controllers/session.controller.js';
import { ProblemFilter } from './bff/errors/problem.filter.js';
import { CapabilityDispatcher, DISPATCHER } from './bff/routing/capability-dispatcher.js';

@Module({})
export class AppModule {
  static forRoot(services: AppServices): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        SessionController,
        RequestsController,
        AttachmentsController,
        AuditController,
        HealthController,
      ],
      providers: [
        { provide: APP_SERVICES, useValue: services },
        { provide: DISPATCHER, useValue: new CapabilityDispatcher(services) },
        // Guards run in registration order: authenticate, then coarse role.
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
    };
  }
}
