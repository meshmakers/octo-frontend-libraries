import { InjectionToken } from '@angular/core';
import { isSecretValueType } from '@meshmakers/octo-services';
import type { ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';

/**
 * Seeded placeholder values of NON-secret configuration attributes (AB#5623), e.g.
 * `TODO_SET_AZURE_TENANT_ID`, that must read as "not configured" instead of as a real value.
 *
 * - A list `readonly string[]` applies to every attribute.
 * - An object lists values `global`ly and/or per attribute (`attributes`, keyed by attribute name
 *   in any casing: `azureTenantId`, `AzureTenantId`).
 *
 * Matching is exact and case-sensitive, on string values only.
 */
export type EntityFormUnsetPlaceholderValues =
  | readonly string[]
  | {
    readonly global?: readonly string[];
    readonly attributes?: Readonly<Record<string, readonly string[]>>;
  };

/**
 * Placeholder values of non-secret attributes that count as "not configured" (AB#5623). Analogous
 * to `ENTITY_FORM_SECRET_PLACEHOLDER_VALUES`, but for plain configuration values:
 *
 * - **List** (`mm-entity-list`): a cell holding a placeholder shows the `notConfigured` message.
 * - **Form** (`mm-entity-form`): the field starts empty with the `notConfigured` message as
 *   placeholder hint; the value counts as unset (a required field is invalid, `VisibleWhen` sees no
 *   value).
 * - **Save**: the form never writes a placeholder back. An untouched placeholder field is not part
 *   of the change set (the stored placeholder stays and keeps reading "not configured"); a typed
 *   value replaces it; emptying the field again is "no change". A host that wants to remove the
 *   placeholder from the store has to write `null` itself (e.g. in `beforeSave`).
 *
 * Never applies to secrets (SECRET decision, AB#5528: secret placeholders are dropped; a secret's
 * state comes from `secretIsSet`): fields with `secret` (value type `SECRET`, CK `secret` metadata,
 * the credential-name rule or a form decision) and attributes listed in `secretFields` are skipped,
 * even when listed here.
 *
 * Optional; not provided = no placeholders (unchanged behaviour). The library ships no values.
 */
export const ENTITY_FORM_UNSET_PLACEHOLDER_VALUES = new InjectionToken<EntityFormUnsetPlaceholderValues>(
  'ENTITY_FORM_UNSET_PLACEHOLDER_VALUES',
);

/** Normalised lookup of {@link EntityFormUnsetPlaceholderValues}. */
export interface EntityFormUnsetPlaceholderLookup {
  readonly global: ReadonlySet<string>;
  /** Keyed by lower-case attribute name. */
  readonly attributes: ReadonlyMap<string, ReadonlySet<string>>;
}

const EMPTY_LOOKUP: EntityFormUnsetPlaceholderLookup = { global: new Set(), attributes: new Map() };

/** Builds the lookup of a placeholder configuration (`null` / `undefined` = none). */
export function entityFormUnsetPlaceholderLookup(
  config: EntityFormUnsetPlaceholderValues | null | undefined,
): EntityFormUnsetPlaceholderLookup {
  if (!config) {
    return EMPTY_LOOKUP;
  }
  if (Array.isArray(config)) {
    return { global: new Set(config.filter(isString)), attributes: new Map() };
  }
  const object = config as Exclude<EntityFormUnsetPlaceholderValues, readonly string[]>;
  const attributes = new Map<string, Set<string>>();
  for (const [name, values] of Object.entries(object.attributes ?? {})) {
    const key = name.toLowerCase();
    const set = attributes.get(key) ?? new Set<string>();
    for (const value of values ?? []) {
      if (isString(value)) {
        set.add(value);
      }
    }
    attributes.set(key, set);
  }
  return { global: new Set((object.global ?? []).filter(isString)), attributes };
}

/** What is known about the attribute a value belongs to. */
export interface EntityFormUnsetPlaceholderTarget {
  attributeName: string;
  valueType?: string | null;
  /** The field / column is treated as a secret (any reason). */
  secret?: boolean;
}

/**
 * Whether `value` is a configured placeholder of the attribute. Always `false` for secrets
 * (`secret` flag or value type `SECRET`) and for non-string values.
 */
export function isEntityFormUnsetPlaceholder(
  lookup: EntityFormUnsetPlaceholderLookup,
  target: EntityFormUnsetPlaceholderTarget,
  value: unknown,
): boolean {
  if (typeof value !== 'string' || target.secret || isSecretValueType(target.valueType)) {
    return false;
  }
  if (lookup.global.has(value)) {
    return true;
  }
  return !!lookup.attributes.get(target.attributeName.toLowerCase())?.has(value);
}

/** Whether a resolved form field may carry an unset placeholder (attribute, not a secret). */
function placeholderCapable(model: ResolvedEntityForm, field: ResolvedField): field is ResolvedField & { attributeName: string } {
  if (field.kind !== 'attribute' || !field.attributeName || field.secret) {
    return false;
  }
  const lower = field.attributeName.toLowerCase();
  return !model.secretFields.some((s) => s.toLowerCase() === lower);
}

/**
 * Keys of the fields whose value in `values` (form values or `state.values`, keyed by field key)
 * is an unset placeholder. Only non-secret attribute fields are considered.
 */
export function entityFormUnsetPlaceholderFields(
  model: ResolvedEntityForm,
  values: Readonly<Record<string, unknown>> | null | undefined,
  lookup: EntityFormUnsetPlaceholderLookup,
): string[] {
  if (!values || (lookup.global.size === 0 && lookup.attributes.size === 0)) {
    return [];
  }
  const keys: string[] = [];
  for (const section of model.sections) {
    for (const field of section.fields) {
      if (placeholderCapable(model, field) && isEntityFormUnsetPlaceholder(lookup, field, values[field.key])) {
        keys.push(field.key);
      }
    }
  }
  return keys;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
