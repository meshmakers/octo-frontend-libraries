import { EntityFormValueState, ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';

/**
 * Values a host puts into a form (AB#5623), keyed by field key: the camelCase attribute name (any
 * casing is accepted), `rtWellKnownName`, or the association field key (`assoc:<role>`).
 *
 * Values use the form value shape (as in {@link EntityFormValueState.values}): strings, numbers,
 * booleans, `Date` for DATE_TIME, arrays for chips and records, and for references either a bare
 * rtId or `{ rtId, ckTypeId, displayName }[]`. Secret fields are never prefilled.
 */
export type EntityFormPrefillValues = Readonly<Record<string, unknown>>;

/** Options of {@link entityFormPrefillState}. */
export interface EntityFormPrefillOptions {
  /** Well-known name of the entity to create (carried even when the form has no such field). */
  rtWellKnownName?: string | null;
}

/**
 * Builds the `state` of `<mm-entity-form mode="create">` from host values (AB#5623): a prefilled
 * value wins over the field's default, everything else starts empty. Equivalent to the form's
 * `initialValues` input; use it when the host already passes a `state`.
 */
export function entityFormPrefillState(values: EntityFormPrefillValues | null | undefined, options: EntityFormPrefillOptions = {}): EntityFormValueState {
  const plain: Record<string, unknown> = {};
  const associations: EntityFormValueState['associations'] = {};
  let rtWellKnownName = options.rtWellKnownName ?? null;
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (key === 'rtWellKnownName') {
      rtWellKnownName ??= typeof value === 'string' ? value : null;
    } else if (key.startsWith('assoc:') && Array.isArray(value)) {
      associations[key] = value as EntityFormValueState['associations'][string];
    } else {
      plain[key] = value;
    }
  }
  return { values: plain, secretPresence: {}, associations, rtWellKnownName };
}

/**
 * Merges host values over a create-mode state (host values win). Returns the state unchanged when
 * there are no values. Canonicalise the keys first ({@link canonicaliseEntityFormPrefill}).
 */
export function mergeEntityFormPrefill(state: EntityFormValueState | null | undefined, values: EntityFormPrefillValues | null | undefined): EntityFormValueState | null {
  if (!values || Object.keys(values).length === 0) {
    return state ?? null;
  }
  const prefill = entityFormPrefillState(values);
  const base = state ?? { values: {}, secretPresence: {}, associations: {}, rtWellKnownName: null };
  return {
    ...base,
    values: { ...base.values, ...prefill.values },
    associations: { ...base.associations, ...prefill.associations },
    rtWellKnownName: base.rtWellKnownName || prefill.rtWellKnownName,
  };
}

/**
 * The field a prefill key addresses: matched by field key, then by attribute name, both
 * case-insensitively. `undefined` for unknown keys.
 */
export function entityFormPrefillField(model: ResolvedEntityForm, key: string): ResolvedField | undefined {
  const lower = key.toLowerCase();
  const fields = model.sections.flatMap((s) => s.fields);
  return fields.find((f) => f.key.toLowerCase() === lower)
    ?? fields.find((f) => (f.attributeName ?? '').toLowerCase() === lower);
}

/**
 * Host values re-keyed to the form's field keys (AB#5623). Unknown keys are kept as they are
 * (`rtWellKnownName` is always kept); secret fields are dropped (never prefilled); a bare rtId for
 * a reference field becomes the reference editor's `{ rtId, ckTypeId, displayName }[]` value.
 */
export function canonicaliseEntityFormPrefill(model: ResolvedEntityForm, values: EntityFormPrefillValues | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    const field = entityFormPrefillField(model, key);
    if (!field) {
      out[key] = value;
      continue;
    }
    if (field.secret) {
      continue;
    }
    out[field.key] = toReferenceValue(field, value);
  }
  return out;
}

/** A bare rtId (or rtId list) for a reference field as the reference editor's value. */
export function toReferenceValue(field: ResolvedField, value: unknown): unknown {
  if (field.editor !== 'reference') {
    return value;
  }
  const ckTypeId = field.reference?.targetCkTypeId ?? '';
  const one = (v: unknown): unknown => (typeof v === 'string' && v ? { rtId: v, ckTypeId, displayName: v } : v);
  if (typeof value === 'string') {
    return value ? [one(value)] : [];
  }
  return Array.isArray(value) ? value.map(one) : value;
}
