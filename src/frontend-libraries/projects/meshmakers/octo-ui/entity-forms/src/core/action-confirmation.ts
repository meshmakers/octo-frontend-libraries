import { InjectionToken } from '@angular/core';
import { ConfirmationService, DangerConfirmationOptions } from '@meshmakers/shared-ui';
import { DEFAULT_ENTITY_FORMS_MESSAGES, EntityFormsMessages, formatEntityFormsMessage } from '../entity-forms.messages';

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
 * Optional host hook asked **before** the component's own danger confirmation of a destructive
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

/**
 * Optional host replacement of the components' own danger confirmation (AB#5579). By default
 * `mm-entity-list` / `mm-entity-page` ask `ConfirmationService.showDangerConfirm(options)`; a host
 * that adds environment knowledge (e.g. the Refinery Studio's `DangerConfirmService`: production =
 * type the name) provides this token instead and then usually needs no
 * {@link ENTITY_FORM_ACTION_CONFIRMATION} for deletes. Resolve `false` to cancel.
 */
export type EntityFormDangerConfirmation = (
  options: DangerConfirmationOptions,
  request: EntityFormActionRequest,
) => Promise<boolean>;

export const ENTITY_FORM_DANGER_CONFIRMATION = new InjectionToken<EntityFormDangerConfirmation>('ENTITY_FORM_DANGER_CONFIRMATION');

/**
 * The danger confirmation of an entity delete (AB#5579): the title names the entity (or the
 * count), `confirmText` = verb + object, texts from {@link EntityFormsMessages}.
 */
export function entityDeleteConfirmation(messages: EntityFormsMessages, names: readonly string[]): DangerConfirmationOptions {
  const d = DEFAULT_ENTITY_FORMS_MESSAGES;
  const text = (key: keyof EntityFormsMessages): string => (messages[key] ?? d[key]) as string;
  if (names.length === 1) {
    const name = names[0];
    return {
      title: formatEntityFormsMessage(text('confirmDeleteNamedTitle'), { name }),
      targetName: name,
      consequence: text('confirmDeleteConsequence'),
      confirmText: text('confirmDeleteConfirmText'),
      cancelText: messages.cancel,
    };
  }
  const count = names.length;
  return {
    title: formatEntityFormsMessage(text('confirmDeleteManyTitle'), { count }),
    targetName: formatEntityFormsMessage(text('confirmDeleteManyTarget'), { count }),
    consequence: formatEntityFormsMessage(text('confirmDeleteManyConsequence'), { count }),
    confirmText: text('confirmDeleteManyConfirmText'),
    cancelText: messages.cancel,
  };
}

/** Asks the host replacement (when provided) or `ConfirmationService.showDangerConfirm`; errors cancel. */
export async function confirmEntityFormDanger(
  hook: EntityFormDangerConfirmation | null | undefined,
  confirmation: ConfirmationService,
  options: DangerConfirmationOptions,
  request: EntityFormActionRequest,
): Promise<boolean> {
  try {
    return hook ? await hook(options, request) : await confirmation.showDangerConfirm(options);
  } catch (error) {
    console.warn('Entity forms: danger confirmation failed; the action is cancelled.', error);
    return false;
  }
}
