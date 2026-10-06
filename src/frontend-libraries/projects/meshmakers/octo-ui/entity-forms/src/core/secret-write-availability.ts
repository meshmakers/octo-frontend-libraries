import { InjectionToken, Signal } from '@angular/core';

/**
 * Whether secrets can be written in this environment (decision Q17, AB#5544): `false` when the
 * environment has no key ring (`SecretEnvironmentStatusDto.keyRingConfigured`, bot services
 * `GET {tenantId}/v1/secrets/status`). Then every secret input of `mm-entity-form` is disabled with
 * a hint instead of failing late on save (`SecretEncryptionNotConfigured`).
 *
 * Optional: without a provider (or while the signal is `null` / `undefined`) secrets are writable.
 * The host provides it from its status client, e.g.
 * `{ provide: ENTITY_FORM_SECRET_KEY_RING_CONFIGURED, useFactory: () => statusService.keyRingConfigured }`.
 */
export const ENTITY_FORM_SECRET_KEY_RING_CONFIGURED = new InjectionToken<Signal<boolean | null | undefined>>(
  'ENTITY_FORM_SECRET_KEY_RING_CONFIGURED',
);
