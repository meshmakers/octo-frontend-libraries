import { computed, inject, InjectionToken, Signal } from '@angular/core';
import { PaletteGroup } from './command-palette.models';

/**
 * UI strings of the command palette (`mm-command-palette`) and of
 * {@link PaletteNavigationService}'s clipboard notifications.
 *
 * Provide translations app wide with {@link COMMAND_PALETTE_MESSAGES} or per instance with the
 * component's `messages` input (wins over the token). Missing, `undefined` or `null` members keep
 * the English default of {@link DEFAULT_COMMAND_PALETTE_MESSAGES}; `{name}` placeholders are
 * filled with {@link formatCommandPaletteMessage}.
 */
export interface CommandPaletteMessages {
  /** `aria-label` of the dialog. */
  dialogLabel: string;
  /** `aria-label` of the search input. */
  inputLabel: string;
  placeholder: string;
  /** Close button on phones. */
  cancel: string;
  /** `aria-label` of the result list. */
  results: string;
  /** `aria-label` of the actions sub-menu; `{label}` = result label. */
  actionsFor: string;
  /** Header of the actions sub-menu; `{label}` = result label. */
  actionsHeader: string;
  /** Tooltip of the Tab hint on rows with actions. */
  tabForActions: string;
  /** Live status with one result. */
  oneResult: string;
  /** Live status; `{count}` = number of results. */
  manyResults: string;
  /** Empty list with a search text; `{text}` = search text. */
  noResultsFor: string;
  /** Empty list without a search text. */
  typeToSearch: string;
  // --- Footer ---
  footerMove: string;
  footerOpen: string;
  footerNewTab: string;
  footerActions: string;
  prefixActions: string;
  prefixEntities: string;
  prefixBoards: string;
  prefixTenants: string;
  // --- Group headers ---
  groupRecent: string;
  groupPage: string;
  groupAction: string;
  groupEntity: string;
  groupBoard: string;
  groupTenant: string;
  groupAi: string;
  // --- Clipboard (PaletteNavigationService.copy) ---
  /** `{label}` = what was copied, e.g. "RtId". */
  copied: string;
  copyFailed: string;
}

export const DEFAULT_COMMAND_PALETTE_MESSAGES: CommandPaletteMessages = {
  dialogLabel: 'Command palette',
  inputLabel: 'Search pages, entities, boards, tenants and commands',
  placeholder: 'Search pages, entities, boards…',
  cancel: 'Cancel',
  results: 'Results',
  actionsFor: 'Actions for {label}',
  actionsHeader: '{label} · Actions',
  tabForActions: 'Tab: actions',
  oneResult: '1 result',
  manyResults: '{count} results',
  noResultsFor: 'No results for “{text}”',
  typeToSearch: 'Type to search',
  footerMove: 'move',
  footerOpen: 'open',
  footerNewTab: 'new tab',
  footerActions: 'actions',
  prefixActions: 'actions',
  prefixEntities: 'entities',
  prefixBoards: 'boards',
  prefixTenants: 'tenants',
  groupRecent: 'Recent',
  groupPage: 'Pages',
  groupAction: 'Actions',
  groupEntity: 'Entities',
  groupBoard: 'Boards',
  groupTenant: 'Tenants',
  groupAi: 'Assistant',
  copied: '{label} copied',
  copyFailed: 'Failed to copy to clipboard',
};

/** App-wide translations of the command palette (partial). */
export const COMMAND_PALETTE_MESSAGES = new InjectionToken<Partial<CommandPaletteMessages>>('COMMAND_PALETTE_MESSAGES');

/** Merges overrides over {@link DEFAULT_COMMAND_PALETTE_MESSAGES}, later sources winning; null/undefined members are ignored. */
export function resolveCommandPaletteMessages(
  ...overrides: (Partial<CommandPaletteMessages> | null | undefined)[]
): CommandPaletteMessages {
  const resolved: CommandPaletteMessages = { ...DEFAULT_COMMAND_PALETTE_MESSAGES };
  for (const messages of overrides) {
    if (!messages) {
      continue;
    }
    for (const key of Object.keys(messages) as (keyof CommandPaletteMessages)[]) {
      const value = messages[key];
      if (value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}

/** Replaces `{name}` placeholders; unknown placeholders stay as they are. */
export function formatCommandPaletteMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

/** The group header of a result group. */
export function paletteGroupLabel(group: PaletteGroup, messages: CommandPaletteMessages): string {
  switch (group) {
    case 'recent': return messages.groupRecent;
    case 'page': return messages.groupPage;
    case 'action': return messages.groupAction;
    case 'entity': return messages.groupEntity;
    case 'board': return messages.groupBoard;
    case 'tenant': return messages.groupTenant;
    case 'ai': return messages.groupAi;
  }
}

/**
 * {@link COMMAND_PALETTE_MESSAGES} merged with a component input (the input wins).
 * Call it in an injection context.
 * @internal
 */
export function commandPaletteMessages(
  input: Signal<Partial<CommandPaletteMessages> | null | undefined>
): Signal<CommandPaletteMessages> {
  const injected = inject(COMMAND_PALETTE_MESSAGES, { optional: true });
  return computed(() => resolveCommandPaletteMessages(injected, input()));
}
