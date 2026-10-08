import { InjectionToken } from '@angular/core';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { EntityFormChangeSet, EntityFormMode, ResolvedEntityForm } from '../models/entity-form.models';

/** What a {@link EntityFormBeforeSaveHook} learns about the save besides the change set. */
export interface EntityFormBeforeSaveContext {
  /** `create` or `edit` (a view form never saves). */
  mode: Exclude<EntityFormMode, 'view'>;
  /** Runtime CK type id of the entity that is saved (the concrete type in create mode). */
  ckTypeId: string;
  /** rtId of the entity in edit mode; absent in create mode. */
  rtId?: string;
  /** The resolved form (fields, sections, secret field names) - metadata only, no values. */
  form: ResolvedEntityForm;
}

/**
 * Result of a {@link EntityFormBeforeSaveHook}:
 * - a change set → saved instead of the original one (`isEmpty` is recomputed);
 * - `undefined` / `void` / `true` → the change set handed to the hook is saved, including any
 *   in-place changes the hook made to it;
 * - `null` / `false` → the save is vetoed silently (the hook told the user itself, or nothing
 *   needs saying). To veto with a message, throw an {@link EntityFormSaveVeto}.
 */
export type EntityFormBeforeSaveResult = EntityFormChangeSet | boolean | null | undefined | void;

/**
 * Host hook run right before an entity form is saved (AB#5623), after validation — e.g. to
 * normalise values (trim texts, format IBAN / BIC / phone numbers, lower-case an e-mail) or to
 * derive attributes (`NormalizedEmail` from `Email`). It may be synchronous or return a
 * `Promise` / `Observable` (the first emitted value counts).
 *
 * - Attribute names in `changeSet.attributes` are the camelCase CK attribute names
 *   (`email`, `normalizedEmail`); values are wire values (strings, numbers, enum keys, …).
 * - Edit mode: the change set holds only changed attributes (D6). A hook that derives an
 *   attribute from another one therefore acts only when the source is in the change set; it may
 *   add attributes that are not in the form.
 * - **Secrets:** the hook sees nothing beyond the change set. A SECRET attribute appears there
 *   only as the write value the user just typed into this form (or in `clearSecretAttributes`
 *   when a clear is staged) — never a stored value, which the form never reads. Do not log the
 *   change set.
 * - Throw an {@link EntityFormSaveVeto} to stop the save with a message for the user; any other
 *   error also stops the save and is reported like a failed save.
 *
 * Provide it as the `beforeSave` input of `mm-entity-form` / `mm-entity-page`, as the
 * `beforeSave` option of `entityFormRoutes` (route data key `entityFormBeforeSave`), or via
 * {@link ENTITY_FORM_BEFORE_SAVE} on a route / root injector. Precedence: input > route data >
 * token.
 */
export type EntityFormBeforeSaveHook = (
  changeSet: EntityFormChangeSet,
  context: EntityFormBeforeSaveContext,
) => EntityFormBeforeSaveResult | Promise<EntityFormBeforeSaveResult> | Observable<EntityFormBeforeSaveResult>;

/** Injection token of a {@link EntityFormBeforeSaveHook} (lowest precedence, see there). */
export const ENTITY_FORM_BEFORE_SAVE = new InjectionToken<EntityFormBeforeSaveHook>('ENTITY_FORM_BEFORE_SAVE');

/**
 * Thrown by a {@link EntityFormBeforeSaveHook} to stop a save on purpose. `userMessage` (already
 * translated by the host) is shown as a warning; without it the generic `saveVetoed` message is
 * shown.
 */
export class EntityFormSaveVeto extends Error {
  constructor(public readonly userMessage?: string) {
    super(userMessage ?? 'The save was vetoed by the host.');
    this.name = 'EntityFormSaveVeto';
  }
}

/** Outcome of {@link runEntityFormBeforeSave}. */
export type EntityFormBeforeSaveOutcome =
  | { kind: 'save'; changeSet: EntityFormChangeSet }
  | { kind: 'veto'; message?: string }
  | { kind: 'error'; error: unknown };

/** True for a thrown {@link EntityFormSaveVeto} (also across bundle copies, by name). */
export function isEntityFormSaveVeto(error: unknown): error is EntityFormSaveVeto {
  return error instanceof EntityFormSaveVeto || (error instanceof Error && error.name === 'EntityFormSaveVeto');
}

function cloneChangeSet(changeSet: EntityFormChangeSet): EntityFormChangeSet {
  return {
    ...changeSet,
    attributes: changeSet.attributes.map((a) => ({ ...a })),
    associations: changeSet.associations.map((a) => ({
      ...a,
      targets: a.targets.map((t) => ({ ...t, target: { ...t.target } })),
    })),
    ...(changeSet.clearSecretAttributes ? { clearSecretAttributes: [...changeSet.clearSecretAttributes] } : {}),
  };
}

function withIsEmpty(changeSet: EntityFormChangeSet): EntityFormChangeSet {
  const attributes = Array.isArray(changeSet.attributes) ? changeSet.attributes : [];
  const associations = Array.isArray(changeSet.associations) ? changeSet.associations : [];
  return {
    ...changeSet,
    attributes,
    associations,
    isEmpty: attributes.length === 0 && associations.length === 0 && !changeSet.rtWellKnownName
      && !changeSet.clearSecretAttributes?.length,
  };
}

/**
 * Runs the host hook on a copy of the change set (the caller's object is never touched) and
 * normalises its result. Absent hook = save unchanged.
 */
export async function runEntityFormBeforeSave(
  hook: EntityFormBeforeSaveHook | null | undefined,
  changeSet: EntityFormChangeSet,
  context: EntityFormBeforeSaveContext,
): Promise<EntityFormBeforeSaveOutcome> {
  if (!hook) {
    return { kind: 'save', changeSet };
  }
  const draft = cloneChangeSet(changeSet);
  try {
    const raw = hook(draft, context);
    const result = isObservable(raw)
      ? await firstValueFrom(raw, { defaultValue: undefined })
      : await raw;
    if (result === null || result === false) {
      return { kind: 'veto' };
    }
    if (result === undefined || result === true) {
      return { kind: 'save', changeSet: withIsEmpty(draft) };
    }
    if (typeof result === 'object' && Array.isArray((result as EntityFormChangeSet).attributes)) {
      return { kind: 'save', changeSet: withIsEmpty(result as EntityFormChangeSet) };
    }
    return { kind: 'error', error: new TypeError('beforeSave returned neither a change set nor a boolean.') };
  } catch (error) {
    if (isEntityFormSaveVeto(error)) {
      return { kind: 'veto', message: error.userMessage };
    }
    return { kind: 'error', error };
  }
}
