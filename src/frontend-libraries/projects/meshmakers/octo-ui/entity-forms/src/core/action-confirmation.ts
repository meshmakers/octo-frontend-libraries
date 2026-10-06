import { InjectionToken } from '@angular/core';

/** A destructive action the entity form components are about to run (AB#5524). */
export interface EntityFormActionRequest {
  action: 'delete';
  /** Runtime CK type id of the (first) affected entity. */
  ckTypeId: string;
  /** Number of affected entities. */
  count: number;
  /** Short English description, e.g. `delete 2 entities`. */
  description: string;
}

/**
 * Optional host hook asked **before** the component's own yes/no confirmation of a destructive
 * action — e.g. the Refinery Studio's production-mode check (`TenantModeService
 * .confirmProductionAction`), which the former configuration list ran before deleting. Resolve
 * `false` to cancel. Provide it on the route (or root) injector of the pages that render
 * `mm-entity-list` / `mm-entity-page`.
 */
export type EntityFormActionConfirmation = (request: EntityFormActionRequest) => Promise<boolean>;

export const ENTITY_FORM_ACTION_CONFIRMATION = new InjectionToken<EntityFormActionConfirmation>('ENTITY_FORM_ACTION_CONFIRMATION');

/** Runs the host hook (absent = allowed); a throwing hook cancels the action. */
export async function confirmEntityFormAction(
  hook: EntityFormActionConfirmation | null | undefined,
  request: EntityFormActionRequest,
): Promise<boolean> {
  if (!hook) {
    return true;
  }
  try {
    return await hook(request);
  } catch (error) {
    console.warn('Entity forms: action confirmation failed; the action is cancelled.', error);
    return false;
  }
}
