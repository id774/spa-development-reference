// backend/src/bff/controllers/session.controller.ts: session endpoint controller
//
// Description:
// Serves GET /api/session, the server-derived application identity used by the
// SPA for presentation only. No role is required, and a caller without a
// recognized group receives an empty role list.
//
// The SPA treats this response, not decoded token claims, as its source for
// roles.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-reference
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

import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../../common/errors.js';

@Controller('api')
export class SessionController {
  /**
   * The server-derived application identity for SPA presentation. No role is
   * required; a caller with no recognized group receives an empty role list.
   */
  @Get('session')
  session(@Req() req: Request) {
    const identity = req.identity;
    if (identity === undefined) throw new AppError('AUTHENTICATION_REQUIRED');
    return {
      subject: identity.subject,
      roles: [...identity.roles],
      ...(identity.email === undefined ? {} : { email: identity.email }),
    };
  }
}
