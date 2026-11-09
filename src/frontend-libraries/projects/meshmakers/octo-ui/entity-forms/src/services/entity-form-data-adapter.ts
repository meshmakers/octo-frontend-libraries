import { Injectable, InjectionToken, inject } from '@angular/core';
import { EntityFormChangeSet, EntityFormMode, ResolvedEntityForm } from '../models/entity-form.models';
import { EntityFormDataService, EntityFormLoadResult } from './entity-form-data.service';

/**
 * What an {@link EntityFormDataAdapter} reads or writes (AB#8591). The form and the page fill `model` and
 * `mode`; the rest names the target. Adapters for other targets extend this interface with their own
 * fields (e.g. an archive row and a reason) — the form passes the host's context through unchanged.
 */
export interface EntityFormDataContext {
  /** The resolved form the values belong to. */
  readonly model: ResolvedEntityForm;
  /** `create` for a new target, `edit` / `view` for an existing one. */
  readonly mode: EntityFormMode;
  /** The edited runtime entity (default adapter: required for `edit`). */
  readonly rtId?: string;
  /** Runtime CK type of the target; defaults to `model.rtCkTypeId`. */
  readonly ckTypeId?: string;
  /** Load by well-known name instead of rtId (default adapter, singleton forms). */
  readonly wellKnownName?: string;
}

/**
 * Why a save was not applied:
 * - `invalid` — the form is invalid (the form shows the errors; the adapter was not called);
 * - `vetoed` — the before-save hook stopped the save (`message` = the hook's text, if any);
 * - `rejected` — the target refused the values (`fieldErrors` / `message` say why);
 * - `forbidden` — the user may not write the target; hosts lock the form and show `message`;
 * - `error` — transport or unexpected failure; the user may try again.
 */
export type EntityFormSaveFailure = 'invalid' | 'vetoed' | 'rejected' | 'forbidden' | 'error';

/** Result of {@link EntityFormDataAdapter.save}. */
export interface EntityFormSaveResult {
  /** True when the target stored the values. */
  readonly applied: boolean;
  /**
   * Text per field (key = field key or attribute name, any casing) shown under that field. The form keeps the
   * user's values; a mark disappears as soon as the user edits that field.
   */
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** A message for the whole save (not tied to a field), already in the user's language. */
  readonly message?: string;
  /** Category of a failed save; absent when `applied`. */
  readonly failure?: EntityFormSaveFailure;
  /** rtId of the stored entity; required from the default adapter on `create`. */
  readonly rtId?: string;
}

/**
 * Where the values of an entity form come from and where they go (AB#8591). The form engine renders,
 * validates and builds the change set; the adapter talks to the target. The default
 * ({@link RtEntityFormDataAdapter}) reads and writes runtime entities through GraphQL; a host supplies its own
 * adapter for other targets (e.g. a stream-data archive row) through the `dataAdapter` input of
 * `mm-entity-form` / `mm-entity-page` or the {@link ENTITY_FORM_DATA_ADAPTER} token.
 *
 * Contract:
 * - `load` resolves the values of the target in form shape (`state.values` keyed by field key), or `null`
 *   when the target does not exist.
 * - `save` gets the change set (only the changed attributes in edit mode, after the before-save hook) and the
 *   current values of every field in form shape (`values`, keyed by field key; also the unchanged ones), and
 *   resolves an {@link EntityFormSaveResult}. Expected refusals (validation, conflicts, permission) resolve with
 *   `applied: false`; an unexpected failure may reject — the page then shows `saveError`.
 * - Never log the change set or the values: they may hold a secret the user typed.
 */
export interface EntityFormDataAdapter<TContext extends EntityFormDataContext = EntityFormDataContext> {
  load(context: TContext): Promise<EntityFormLoadResult | null>;
  save(context: TContext, changeSet: EntityFormChangeSet, values: Readonly<Record<string, unknown>>): Promise<EntityFormSaveResult>;
}

/**
 * App-wide data adapter of entity forms (AB#8591). The `dataAdapter` input of `mm-entity-form` /
 * `mm-entity-page` wins; without both the runtime-entity adapter ({@link RtEntityFormDataAdapter}) applies.
 */
export const ENTITY_FORM_DATA_ADAPTER = new InjectionToken<EntityFormDataAdapter>('ENTITY_FORM_DATA_ADAPTER');

/**
 * The default data adapter (AB#8591): runtime entities through GraphQL, exactly the path entity forms used
 * before adapters existed — `EntityFormDataService.load` / `create` / `update`. Errors of the server reject
 * (the page shows `saveError` with the message), as before.
 */
@Injectable({ providedIn: 'root' })
export class RtEntityFormDataAdapter implements EntityFormDataAdapter {
  private readonly dataService = inject(EntityFormDataService);

  load(context: EntityFormDataContext): Promise<EntityFormLoadResult | null> {
    const type = context.ckTypeId ? { ckTypeId: context.ckTypeId } : {};
    if (context.rtId) {
      return this.dataService.load(context.model, { rtId: context.rtId, ...type });
    }
    if (context.wellKnownName) {
      return this.dataService.load(context.model, { wellKnownName: context.wellKnownName, ...type });
    }
    return Promise.resolve(null);
  }

  async save(context: EntityFormDataContext, changeSet: EntityFormChangeSet): Promise<EntityFormSaveResult> {
    const ckTypeId = context.ckTypeId || context.model.rtCkTypeId;
    if (context.mode === 'create') {
      const rtId = await this.dataService.create(context.model, ckTypeId, changeSet);
      return { applied: true, rtId };
    }
    if (!context.rtId) {
      throw new Error('RtEntityFormDataAdapter: save in edit mode needs context.rtId.');
    }
    await this.dataService.update(context.rtId, ckTypeId, changeSet);
    return { applied: true, rtId: context.rtId };
  }
}
