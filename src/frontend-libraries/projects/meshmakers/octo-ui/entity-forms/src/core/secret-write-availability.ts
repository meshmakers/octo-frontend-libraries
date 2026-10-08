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

/**
 * Values that count as "not set" for LEGACY secret fields (AB#5623): plain `STRING` attributes
 * treated as secrets by form decision, CK metadata or the credential-name rule. Their presence is
 * probed with field filters (`IS_NOT_NULL` and `NOT_EQUALS ''`); each value listed here adds a
 * `NOT_EQUALS <value>` filter, so a seeded placeholder (exact, case-sensitive match) reads
 * "Not set" instead of "Set".
 *
 * Optional; not provided = only `null` and `''` count as not set (unchanged behaviour). The
 * library ships no placeholder values of its own — the host lists the ones its seed data uses.
 * It has no effect on attributes of value type `SECRET` (AB#5528): their state comes from the
 * server (`secretIsSet`), which is the reliable way — migrate secrets to `SECRET` where possible.
 */
export const ENTITY_FORM_SECRET_PLACEHOLDER_VALUES = new InjectionToken<readonly string[]>(
  'ENTITY_FORM_SECRET_PLACEHOLDER_VALUES',
);
