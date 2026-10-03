// backend/src/bff/auth/guards.ts: authentication and coarse role guards
//
// Description:
// Implements the first two steps of the request evaluation order. AuthGuard
// validates the bearer access token through the identity provider, attaches
// the derived identity to the request, and records the user and operation in
// the request context. RolesGuard enforces the coarse role requirement
// declared by the Roles decorator.
//
// The Public decorator exempts an operation from authentication. Roles are
// always derived by the server; this file never trusts a role supplied by the
// browser.
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

import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { currentContext } from '../../common/context.js';
import { AppError } from '../../common/errors.js';
import { hasRole, type Identity, type Role } from '../../capabilities/shared/identity.js';
import { APP_SERVICES, type AppServices } from '../app-services.js';

const PUBLIC_KEY = 'bff:public';
const ROLES_KEY = 'bff:roles';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Coarse role requirement: the caller needs at least one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

declare module 'express-serve-static-core' {
  interface Request {
    identity?: Identity;
    accessToken?: string;
  }
}

/** Step 1: authenticate the bearer access token. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(APP_SERVICES) private readonly services: AppServices,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const match = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '');
    if (match === null || match[1] === undefined) throw new AppError('AUTHENTICATION_REQUIRED');

    const identity = await this.services.identity.authenticate(match[1]);
    req.identity = identity;
    req.accessToken = match[1];
    const requestContext = currentContext();
    if (requestContext) {
      requestContext.userId = identity.subject;
      requestContext.operation = `${req.method} ${String(req.route?.path ?? req.path)}`;
    }
    return true;
  }
}

/** Step 2: enforce the operation's coarse role requirement. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined) return true;
    const identity = context.switchToHttp().getRequest<Request>().identity;
    if (identity === undefined || !hasRole(identity, ...required)) {
      throw new AppError('FORBIDDEN');
    }
    return true;
  }
}
