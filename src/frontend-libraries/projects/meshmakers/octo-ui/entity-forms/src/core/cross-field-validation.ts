import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { EntityFormMode, ResolvedEntityForm, ResolvedField } from '../models/entity-form.models';

/**
 * Form-level (cross-field) validation hook of `mm-entity-form` (AB#7422).
 *
 * The per-field rules of a form definition (`required`, `min`, `max`, `pattern`) cannot express a
 * rule over several fields, e.g. "request must not exceed limit". A host registers an
 * {@link EntityFormCrossFieldValidator} for the CK types it knows; the library stays free of any
 * domain knowledge. The validator is re-run on every value change and answers one message per
 * offending field. Each named field is marked invalid (the message is shown under it, immediately,
 * without waiting for the user to touch it) and the form cannot be saved until the validator
 * answers `null` / an empty object.
 */
export interface EntityFormCrossFieldContext {
  /**
   * Current values of the enabled (visible, writable) fields, keyed by field key — for attribute
   * fields the camelCase attribute name. Values are form values (strings, numbers, booleans, ...).
   */
  readonly values: Readonly<Record<string, unknown>>;
  /** The resolved form (metadata only). */
  readonly form: ResolvedEntityForm;
  readonly mode: EntityFormMode;
}

/**
 * Messages by field: the key is a field key or an attribute name (any casing), the value the
 * text shown under that field. Unknown keys and keys of disabled fields are ignored.
 */
export type EntityFormCrossFieldErrors = Readonly<Record<string, string>>;

export interface EntityFormCrossFieldValidator {
  /**
   * CK type ids (`System.Communication/DeployableWorkload`, case-insensitive) the validator applies
   * to. A form matches when its concrete runtime type **or one of that type's ancestors** is listed,
   * so a rule on a base type also covers every derived type.
   */
  readonly ckTypeIds: readonly string[];
  /** Pure function of the context. A throwing validator is ignored (logged once per call). */
  validate(context: EntityFormCrossFieldContext): EntityFormCrossFieldErrors | null | undefined;
}

/** Entry of {@link ENTITY_FORM_CROSS_FIELD_VALIDATORS}: one validator or a list of them. */
export type EntityFormCrossFieldValidatorProvision = EntityFormCrossFieldValidator | readonly EntityFormCrossFieldValidator[];

/**
 * Multi token of host validators (root or lazy route). Prefer {@link provideEntityFormCrossFieldValidators}.
 * The `crossFieldValidators` input of `mm-entity-form` is applied in addition to these.
 */
export const ENTITY_FORM_CROSS_FIELD_VALIDATORS = new InjectionToken<EntityFormCrossFieldValidatorProvision>(
  'ENTITY_FORM_CROSS_FIELD_VALIDATORS',
);

/** Registers validators on a route or at root; several registrations add up. */
export function provideEntityFormCrossFieldValidators(
  ...validators: EntityFormCrossFieldValidator[]
): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: ENTITY_FORM_CROSS_FIELD_VALIDATORS, multi: true, useValue: validators }]);
}

/** Flattens the injected multi-provider value (`null` / single / list entries). */
export function flattenCrossFieldValidators(
  provided: EntityFormCrossFieldValidatorProvision | readonly EntityFormCrossFieldValidatorProvision[] | null | undefined,
): EntityFormCrossFieldValidator[] {
  if (!provided) {
    return [];
  }
  const out: EntityFormCrossFieldValidator[] = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
    } else if (entry && typeof (entry as EntityFormCrossFieldValidator).validate === 'function') {
      out.push(entry as EntityFormCrossFieldValidator);
    }
  };
  visit(provided);
  return out;
}

const norm = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** True when the validator applies to the form's concrete type or one of its ancestors. */
export function crossFieldValidatorApplies(validator: EntityFormCrossFieldValidator, form: ResolvedEntityForm): boolean {
  const types = new Set([norm(form.rtCkTypeId), ...(form.ckTypeAncestors ?? []).map(norm)]);
  return validator.ckTypeIds.some((id) => types.has(norm(id)));
}

/**
 * Runs every applicable validator and maps the answer to field keys. The first message per field
 * wins (validators run in registration order). Names that match no field are dropped.
 */
export function runCrossFieldValidators(
  validators: readonly EntityFormCrossFieldValidator[],
  form: ResolvedEntityForm,
  fields: readonly ResolvedField[],
  values: Readonly<Record<string, unknown>>,
  mode: EntityFormMode,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (validators.length === 0) {
    return result;
  }
  const byName = new Map<string, string>();
  for (const f of fields) {
    byName.set(norm(f.key), f.key);
    if (f.attributeName) {
      byName.set(norm(f.attributeName), f.key);
    }
  }
  for (const validator of validators) {
    if (!crossFieldValidatorApplies(validator, form)) {
      continue;
    }
    let answer: EntityFormCrossFieldErrors | null | undefined;
    try {
      answer = validator.validate({ values, form, mode });
    } catch (error) {
      console.error('mm-entity-form: a cross-field validator failed and was ignored', error);
      continue;
    }
    for (const [name, message] of Object.entries(answer ?? {})) {
      const key = byName.get(norm(name));
      if (key && message && !(key in result)) {
        result[key] = message;
      }
    }
  }
  return result;
}
