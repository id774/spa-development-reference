// License: The GPL version 3, or LGPL version 3 (Dual License).
import { AppError } from '../../common/errors.js';
import type { Identity, IdentityProvider, Role } from '../../capabilities/shared/identity.js';

interface DemoIdentity {
  subject: string;
  role: Role;
  email: string;
}

/**
 * The three fixed demo identities of the local demo mode. The tokens are not
 * credentials: they exist only so that the demo needs no identity provider.
 */
export const DEMO_IDENTITIES: Readonly<Record<string, DemoIdentity>> = {
  'demo-requester': {
    subject: 'local-requester',
    role: 'Requester',
    email: 'requester@example.test',
  },
  'demo-approver': {
    subject: 'local-approver',
    role: 'Approver',
    email: 'approver@example.test',
  },
  'demo-administrator': {
    subject: 'local-administrator',
    role: 'Administrator',
    email: 'administrator@example.test',
  },
};

/**
 * Identity port for the local demo mode only. It accepts exactly the three demo
 * bearer tokens and maps each to its fixed identity. It is never selected in
 * the aws mode, so demo tokens are not accepted there.
 */
export class LocalIdentityProvider implements IdentityProvider {
  async authenticate(token: string): Promise<Identity> {
    const demo = Object.hasOwn(DEMO_IDENTITIES, token) ? DEMO_IDENTITIES[token] : undefined;
    if (demo === undefined) throw new AppError('AUTHENTICATION_REQUIRED');
    return { subject: demo.subject, roles: [demo.role] };
  }

  async resolveVerifiedEmail(token: string, subject: string): Promise<string | null> {
    const demo = Object.hasOwn(DEMO_IDENTITIES, token) ? DEMO_IDENTITIES[token] : undefined;
    return demo !== undefined && demo.subject === subject ? demo.email : null;
  }
}
