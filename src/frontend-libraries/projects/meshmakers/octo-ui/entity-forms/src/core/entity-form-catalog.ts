import { EntityFormDefinition } from '../models/entity-form.models';
import { toKebabTypeKey } from './attribute-path';
import { humanize } from './entity-form-resolver';

/** Prefix of the well-known names of delivered forms (`form-sftp-configuration`). */
const FORM_WELL_KNOWN_NAME_PREFIX = 'form-';

/**
 * URL key of a form (`sftp-configuration`), accepted by `EntityFormService.resolveByFormKey`:
 * the well-known name without the `form-` prefix, otherwise the kebab-cased target type name.
 * The well-known name wins because the kebab form of some type names differs from the seeded
 * name (`EMailSenderConfiguration` → `e-mail-sender-configuration`, seeded as
 * `form-email-sender-configuration`).
 */
export function entityFormKey(form: Pick<EntityFormDefinition, 'rtWellKnownName' | 'targetCkTypeId'>): string {
  const name = (form.rtWellKnownName ?? '').trim().toLowerCase();
  if (name.startsWith(FORM_WELL_KNOWN_NAME_PREFIX) && name.length > FORM_WELL_KNOWN_NAME_PREFIX.length) {
    return name.substring(FORM_WELL_KNOWN_NAME_PREFIX.length);
  }
  return toKebabTypeKey(form.targetCkTypeId);
}

/** One entry of {@link entityFormCatalog}: the effective form of one target type. */
export interface EntityFormCatalogEntry {
  /** URL key (see {@link entityFormKey}); stable per target type. */
  key: string;
  /** Settings category key (`connections`, `ai`, …), lower case. */
  category: string;
  title: string;
  description?: string;
  icon?: string;
  targetCkTypeId: string;
  includeDerivedTypes: boolean;
  singleton: boolean;
  /** The form that wins for the target type (tenant form before seeded, then priority). */
  form: EntityFormDefinition;
}

function compareForms(a: EntityFormDefinition, b: EntityFormDefinition): number {
  if (a.isTenantForm !== b.isTenantForm) {
    return a.isTenantForm ? -1 : 1;
  }
  if ((a.priority ?? 0) !== (b.priority ?? 0)) {
    return (b.priority ?? 0) - (a.priority ?? 0);
  }
  const ka = a.rtWellKnownName || a.rtId || '';
  const kb = b.rtWellKnownName || b.rtId || '';
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * The forms that belong in a settings overview (concept §5.6): one entry per target type whose
 * effective form has a `Category`. The effective form is picked like the resolver does for an
 * exact type match (tenant form first, then higher priority, then well-known name), so a tenant
 * override replaces the delivered entry — and can also move it to another category or remove it
 * from the overview by leaving `Category` empty. The key prefers a delivered `form-*` name of
 * the type, so URLs stay stable when a tenant form is added. Sorted by title.
 */
export function entityFormCatalog(forms: readonly EntityFormDefinition[]): EntityFormCatalogEntry[] {
  const byType = new Map<string, EntityFormDefinition[]>();
  for (const form of forms) {
    const target = (form.targetCkTypeId ?? '').trim();
    if (!target) {
      continue;
    }
    const id = target.toLowerCase();
    byType.set(id, [...(byType.get(id) ?? []), form]);
  }

  const entries: EntityFormCatalogEntry[] = [];
  for (const candidates of byType.values()) {
    const sorted = [...candidates].sort(compareForms);
    const winner = sorted[0];
    const category = (winner.category ?? '').trim().toLowerCase();
    if (!category) {
      continue;
    }
    const keySource = sorted.find((f) => (f.rtWellKnownName ?? '').toLowerCase().startsWith(FORM_WELL_KNOWN_NAME_PREFIX)) ?? winner;
    const shortName = winner.targetCkTypeId.substring(winner.targetCkTypeId.lastIndexOf('/') + 1);
    entries.push({
      key: entityFormKey(keySource),
      category,
      title: winner.name?.trim() || humanize(shortName),
      ...(winner.description?.trim() && { description: winner.description.trim() }),
      ...(winner.icon?.trim() && { icon: winner.icon.trim() }),
      targetCkTypeId: winner.targetCkTypeId,
      includeDerivedTypes: winner.includeDerivedTypes,
      singleton: !!winner.singleton,
      form: winner,
    });
  }
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}
