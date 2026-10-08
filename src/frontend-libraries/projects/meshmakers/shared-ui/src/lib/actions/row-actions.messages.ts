import {InjectionToken} from '@angular/core';

/**
 * Texts of `mm-row-actions` (G16). `{name}` is replaced by the row label; the `…For` members are
 * used when the row has a label, the plain ones when it is empty.
 */
export interface RowActionsMessages {
  /** Accessible name of the action group: "Actions for {name}". */
  actionsFor: string;
  /** Group name without a row label. */
  actions: string;
  /** Accessible name and tooltip of the overflow button: "More actions for {name}". */
  moreActionsFor: string;
  /** Overflow button without a row label. */
  moreActions: string;
}

export const DEFAULT_ROW_ACTIONS_MESSAGES: RowActionsMessages = {
  actionsFor: 'Actions for {name}',
  actions: 'Actions',
  moreActionsFor: 'More actions for {name}',
  moreActions: 'More actions',
};

/** App-wide translations of `mm-row-actions`. Partial: members left out keep their English default. */
export const MM_ROW_ACTIONS_MESSAGES = new InjectionToken<Partial<RowActionsMessages>>('MM_ROW_ACTIONS_MESSAGES');

/**
 * Merges overrides over {@link DEFAULT_ROW_ACTIONS_MESSAGES}, later sources winning; members that
 * are missing, `undefined` or `null` keep the earlier value.
 */
export function resolveRowActionsMessages(
  ...overrides: (Partial<RowActionsMessages> | null | undefined)[]
): RowActionsMessages {
  const resolved: RowActionsMessages = {...DEFAULT_ROW_ACTIONS_MESSAGES};
  for (const messages of overrides) {
    if (!messages) {
      continue;
    }
    for (const key of Object.keys(messages) as (keyof RowActionsMessages)[]) {
      const value = messages[key];
      if (value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}
