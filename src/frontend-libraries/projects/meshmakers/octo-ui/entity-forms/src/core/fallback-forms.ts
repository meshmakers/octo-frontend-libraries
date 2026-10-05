import { InjectionToken } from '@angular/core';
import { EntityFormDefinition } from '../models/entity-form.models';

/**
 * Host-provided built-in forms (AB#5524). Each one stands in for a delivered form of its target
 * type **only while the tenant has no form for that exact type** — e.g. before a new version of
 * the seeding blueprint has been rolled out — the same idea as the built-in `form-default`
 * safety net (concept §5.3 step 4), but per type and owned by the host.
 *
 * Use the delivered form's `rtWellKnownName` (`form-sap-configuration`) so URL keys stay the same
 * when the seeded form arrives, set `isTenantForm: false` and leave `rtId` empty. As soon as any
 * form (tenant or seeded) targets the type, the fallback is ignored — a tenant can therefore hide
 * a fallback entry from a settings overview by creating a form without `Category`.
 */
export const ENTITY_FORM_FALLBACK_FORMS = new InjectionToken<readonly EntityFormDefinition[]>('ENTITY_FORM_FALLBACK_FORMS');

/**
 * The loaded forms plus every fallback whose target type no loaded form targets (exact type,
 * case-insensitive). Later fallbacks for an already covered type are dropped as well.
 */
export function withFallbackForms(
  loaded: readonly EntityFormDefinition[],
  fallbacks: readonly EntityFormDefinition[] | null | undefined,
): EntityFormDefinition[] {
  const result = [...loaded];
  if (!fallbacks?.length) {
    return result;
  }
  const covered = new Set(loaded.map((f) => (f.targetCkTypeId ?? '').trim().toLowerCase()).filter((t) => !!t));
  for (const fallback of fallbacks) {
    const target = (fallback.targetCkTypeId ?? '').trim().toLowerCase();
    if (!target || covered.has(target)) {
      continue;
    }
    covered.add(target);
    result.push({ ...fallback, isTenantForm: false });
  }
  return result;
}
