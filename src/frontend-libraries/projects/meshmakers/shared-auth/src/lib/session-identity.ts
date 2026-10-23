import { InjectionToken } from '@angular/core';

/**
 * Who is signed in and on which tenant — the identity an app may hand to its browser monitoring
 * (AB#7327). All fields are personal or tenant-scoped data; only an app that opted in by providing a
 * {@link SessionIdentitySink} ever receives them.
 */
export interface SessionIdentity {
  /** The `sub` claim of the signed-in user. */
  userId: string;
  /** Display/user name of the signed-in user, when the identity provider supplies one. */
  name: string | null;
  /** E-mail address of the signed-in user, when the identity provider supplies one. */
  email: string | null;
  /** Tenant the current access token was issued for (`tenant_id` claim); null when the token has none. */
  tenantId: string | null;
}

/**
 * Receiver of the session identity. `AuthorizeService` calls `set` after sign-in and after every tenant
 * switch (whenever the identity changes) and `clear` when the session ends. Implementations must be cheap
 * and synchronous; any exception they throw is caught and logged by the service and never reaches auth.
 */
export interface SessionIdentitySink {
  set(identity: SessionIdentity): void;
  clear(): void;
}

/**
 * Optional DI token. Apps that provide it get their sink driven by `AuthorizeService`; apps that do not
 * see no behaviour change at all. See `provideDash0SessionIdentity()` in `@meshmakers/shared-auth/dash0`.
 */
export const SESSION_IDENTITY_SINK = new InjectionToken<SessionIdentitySink>('SESSION_IDENTITY_SINK');

/** True when both identities describe the same user on the same tenant. */
export function sameSessionIdentity(a: SessionIdentity | null, b: SessionIdentity | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return a.userId === b.userId && a.name === b.name && a.email === b.email && a.tenantId === b.tenantId;
}
