/*
 * Public API Surface of @meshmakers/shared-ui/command-palette (AB#5621)
 */

/**
 * The command palette (Cmd/Ctrl+K) of the OctoMesh Refinery Studio as an app-agnostic building
 * block: the overlay component, the open/close service with the hotkey mapping, query parsing,
 * multi-provider search and ranking. It knows no data source of its own — every row comes from a
 * {@link PALETTE_PROVIDERS} entry the host registers (pages, actions, entities, tenants …).
 *
 * Usage:
 *
 * ```ts
 * import { CommandPaletteComponent, CommandPaletteService, PALETTE_PROVIDERS, PaletteProvider,
 *          paletteHotkeyAction } from '@meshmakers/shared-ui/command-palette';
 *
 * // app.config.ts
 * providers: [
 *   { provide: PALETTE_PROVIDERS, useClass: PagesPaletteProvider, multi: true },
 *   { provide: PALETTE_PROVIDERS, useClass: TenantsPaletteProvider, multi: true },
 * ]
 *
 * // AppComponent: host the overlay and bind the hotkeys
 * template: `@if (palette.isOpen()) { <mm-command-palette /> }`
 * @HostListener('document:keydown', ['$event'])
 * onKeydown(event: KeyboardEvent): void {
 *   const action = paletteHotkeyAction(event, this.palette.isOpen());
 *   if (action) { event.preventDefault(); action === 'toggle' ? this.palette.toggle() : this.palette.open(); }
 * }
 * ```
 *
 * A provider implements {@link PaletteProvider}: `search(query)` returns an Observable of
 * {@link PaletteResult}s (a new query cancels the previous search; `debounceMs` for remote
 * sources; an error drops only that provider's rows), `reset()` runs whenever the palette opens.
 * {@link PaletteNavigationService} offers tenant-relative navigation and clipboard helpers.
 *
 * Optional providers:
 * - `PALETTE_RECENT_ITEMS_SOURCE` — frecency per `recentKey` (boosts recently used rows);
 * - `COMMAND_PALETTE_MESSAGES` — translations (`Partial<CommandPaletteMessages>`, English defaults;
 *   the component's `messages` input wins over the token).
 */

// --- Contract ---
export { PALETTE_PROVIDERS, PALETTE_RECENT_ITEMS_SOURCE } from './command-palette.models';
export type {
  PaletteGroup,
  PaletteRunMode,
  PaletteRunOutcome,
  PaletteRunResult,
  PaletteAction,
  PaletteResult,
  PaletteQuery,
  PaletteProvider,
  PaletteRecentItemsSource,
} from './command-palette.models';

// --- Messages / i18n ---
export {
  DEFAULT_COMMAND_PALETTE_MESSAGES,
  COMMAND_PALETTE_MESSAGES,
  resolveCommandPaletteMessages,
  formatCommandPaletteMessage,
  paletteGroupLabel,
} from './command-palette.messages';
export type { CommandPaletteMessages } from './command-palette.messages';

// --- Services ---
export { CommandPaletteService, paletteHotkeyAction } from './command-palette.service';
export type { PaletteOpenRequest, PaletteHotkeyAction } from './command-palette.service';
export { PaletteNavigationService } from './palette-navigation.service';

// --- Pure functions ---
export { PALETTE_PREFIXES, parsePaletteQuery, isRtId } from './palette-query';
export { searchProviders } from './palette-search';
export { MatchTier, matchTier, scoreResult, rankResults, highlightSegments, stabilizeRanking } from './palette-ranking';
export type { RankedGroup } from './palette-ranking';

// --- Component ---
export { CommandPaletteComponent } from './command-palette.component';
