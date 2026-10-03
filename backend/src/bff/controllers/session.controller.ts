// License: The GPL version 3, or LGPL version 3 (Dual License).
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
