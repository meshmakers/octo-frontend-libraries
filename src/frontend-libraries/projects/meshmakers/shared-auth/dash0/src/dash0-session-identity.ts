import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { addSignalAttribute, identify, removeSignalAttribute } from '@dash0/sdk-web';
import { SESSION_IDENTITY_SINK, SessionIdentity, SessionIdentitySink } from '@meshmakers/shared-auth';

/** Signal attribute for the current tenant — the same key the backend services use (mm-common). */
export const DASH0_TENANT_ATTRIBUTE = 'octo.tenant.id';

/** The subset of `@dash0/sdk-web` this adapter uses; replaceable in tests. */
export interface Dash0IdentityApi {
  identify(id?: string, opts?: { name?: string; email?: string }): void;
  addSignalAttribute(name: string, value: string): void;
  removeSignalAttribute(name: string): void;
}

const sdkApi: Dash0IdentityApi = { identify, addSignalAttribute, removeSignalAttribute };

/**
 * Maps the session identity onto Dash0 signal attributes: `user.id` (sub), `user.name`, `user.email`
 * (via `identify`) and `octo.tenant.id`. `clear` removes all four. When the Dash0 SDK was not initialised
 * in this environment, the SDK calls only touch its internal attribute list and nothing is transmitted.
 */
export function createDash0SessionIdentitySink(api: Dash0IdentityApi = sdkApi): SessionIdentitySink {
  return {
    set(identity: SessionIdentity): void {
      api.identify(identity.userId, {
        name: identity.name ?? undefined,
        email: identity.email ?? undefined
      });
      if (identity.tenantId) {
        api.addSignalAttribute(DASH0_TENANT_ATTRIBUTE, identity.tenantId);
      } else {
        api.removeSignalAttribute(DASH0_TENANT_ATTRIBUTE);
      }
    },
    clear(): void {
      api.identify();
      api.removeSignalAttribute(DASH0_TENANT_ATTRIBUTE);
    }
  };
}

/**
 * Opt-in: tells Dash0 browser monitoring who is signed in and on which tenant.
 *
 * @example
 * ```typescript
 * // app.config.ts — next to provideMmSharedAuth()
 * providers: [provideMmSharedAuth(), provideDash0SessionIdentity()]
 * ```
 *
 * Name and e-mail are personal data sent to Dash0; see the shared-auth README.
 */
export function provideDash0SessionIdentity(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SESSION_IDENTITY_SINK, useFactory: () => createDash0SessionIdentitySink() }
  ]);
}
