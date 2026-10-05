import { InjectionToken } from '@angular/core';
import { CkTypeInfo, EntityFormDefinition } from '../models/entity-form.models';
import { pickEntityForm } from './entity-form-resolver';

/**
 * Host-provided built-in forms (AB#5524). Each one stands in for a delivered form of its target
 * type **only where the normal resolution would end at the chain end** (`form-default` on
 * `System/Entity`, or no form at all) — e.g. before a new version of the seeding blueprint has
 * been rolled out. A tenant or seeded form for the exact type, or for an ancestor with
 * `IncludeDerivedTypes`, always wins over a fallback. Same idea as the built-in `form-default`
 * safety net (concept §5.3 step 4), but per type and owned by the host.
 *
 * Provide them at root with this token, or — to keep the entry point out of the initial bundle —
 * with `provideEntityFormFallbacks(forms)` on lazy routes (registers them in the root
 * `EntityFormService`, one cache).
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

/** The end of the resolution chain: a form on `System/Entity` (the seeded or built-in `form-default`). */
export function isChainEndForm(form: Pick<EntityFormDefinition, 'targetCkTypeId'>): boolean {
  return (form.targetCkTypeId ?? '').trim().toLowerCase() === 'system/entity';
}

/**
 * The fallbacks that apply on top of the loaded forms: per target type (first fallback wins),
 * only when the type exists (`typeOf` returns its CK metadata) and `pickEntityForm(type, loaded)`
 * finds nothing or only the chain end. Fallbacks for a type without metadata are dropped, so a
 * tenant without that model gets no Settings entry for it.
 */
export function selectFallbackForms(
  loaded: readonly EntityFormDefinition[],
  fallbacks: readonly EntityFormDefinition[] | null | undefined,
  typeOf: (rtCkTypeId: string) => CkTypeInfo | null | undefined,
): EntityFormDefinition[] {
  const candidates = withFallbackForms(loaded, fallbacks).slice(loaded.length);
  return candidates.filter((fallback) => {
    const type = typeOf(fallback.targetCkTypeId);
    if (!type) {
      return false;
    }
    const picked = pickEntityForm(type, loaded);
    return !picked || isChainEndForm(picked.form);
  });
}
