// License: The GPL version 3, or LGPL version 3 (Dual License).

export const ROLES = ['Requester', 'Approver', 'Administrator'] as const;
export type Role = (typeof ROLES)[number];

/** The application identity the BFF derives from a validated access token. */
export interface Identity {
  readonly subject: string;
  readonly roles: readonly Role[];
  readonly email?: string | undefined;
}

export function hasRole(identity: Identity, ...roles: Role[]): boolean {
  return roles.some((role) => identity.roles.includes(role));
}

/** Unique roles in the fixed order Requester, Approver, Administrator. */
export function sortRoles(roles: Iterable<Role>): Role[] {
  const present = new Set(roles);
  return ROLES.filter((role) => present.has(role));
}

/** Identity port. Provider-specific types stop inside the adapter. */
export interface IdentityProvider {
  /** Validates a bearer access token and returns the application identity. */
  authenticate(token: string): Promise<Identity>;
  /** Returns the verified email of the token's subject, or null when there is none. */
  resolveVerifiedEmail(token: string, subject: string): Promise<string | null>;
}
