import { InjectionToken } from '@angular/core';
import { SVGIcon } from '@progress/kendo-svg-icons';
import { Observable } from 'rxjs';

/**
 * Result groups of the command palette, in the vocabulary of
 * `docs/concepts/ui-concept-ai-os.md` §4.1. The group decides the section
 * header a result is listed under and which typed prefix scopes to it.
 */
export type PaletteGroup = 'recent' | 'page' | 'action' | 'entity' | 'board' | 'tenant' | 'ai';

/** How a result is opened: Enter opens in place, Cmd/Ctrl+Enter in a new browser tab. */
export type PaletteRunMode = 'open' | 'newTab';

/**
 * What the palette does after a result or action ran. By default it closes;
 * an outcome with `query` keeps it open and replaces the query (e.g. "Switch
 * tenant…" re-scopes the palette to `/`).
 */
export interface PaletteRunOutcome {
  query: string;
}

export type PaletteRunResult = PaletteRunOutcome | void;

/** One entry of a result's actions sub-menu (opened with Tab). */
export interface PaletteAction {
  id: string;
  label: string;
  /** Keyboard hint shown on the right, e.g. '↵'. */
  hint?: string;
  run(): Promise<PaletteRunResult>;
}

/** One row of the palette. Providers create them; the ranking orders them. */
export interface PaletteResult {
  /** Unique and stable across searches (prefix it with the provider id). */
  id: string;
  group: PaletteGroup;
  label: string;
  /** Secondary text on the right, e.g. "Adapter · Online". */
  description?: string;
  /** Where the result lives, e.g. ['Integration'] — rendered "Integration ›". */
  path?: string[];
  /** Technical id rendered in mono type, e.g. an rtId or ckTypeId. */
  typeHint?: string;
  icon?: SVGIcon;
  /** One-character text icon used when there is no SVG icon. */
  glyph?: string;
  /** Extra search terms (matched one tier below the label). */
  keywords?: string[];
  /** Key into the recents store; results with a key get the frecency boost. */
  recentKey?: string;
  /** Set by entity providers when the query was this result's exact id: ranks first. */
  exactMatch?: boolean;
  /**
   * Extra ranking weight 0…1 on top of the frecency, e.g. 1 for a pinned board, so pinned
   * and recently used rows lead their group (only orders within a match tier).
   */
  rankBoost?: number;
  /** Keep this row after ranking even without a text match (e.g. the assistant fallback). */
  alwaysShow?: boolean;
  run(mode: PaletteRunMode): Promise<PaletteRunResult>;
  /** Sub-menu opened with Tab. */
  actions?: PaletteAction[];
}

/** A parsed palette query: an optional scope from a typed prefix plus the search text. */
export interface PaletteQuery {
  /** The input exactly as typed. */
  raw: string;
  /** The prefix character when one was typed ('>', '@', '#', '/', '?'). */
  prefix: string | null;
  /** The group the prefix scopes to, or null for an unscoped search. */
  scope: PaletteGroup | null;
  /** The search text without the prefix, trimmed. */
  text: string;
}

/**
 * One async result source. The palette calls `search` for every query
 * change; a new query unsubscribes the previous search (cancellation), and a
 * provider with `debounceMs` is only asked once typing paused that long.
 * A provider error drops that provider's rows only.
 */
export interface PaletteProvider {
  /** Stable id, used to prefix result ids. */
  readonly id: string;
  /** Groups this provider produces; a scoped query skips providers without that group. */
  readonly groups: readonly PaletteGroup[];
  /** Remote providers debounce (§4.2: 150 ms); local ones answer immediately. */
  readonly debounceMs?: number;
  search(query: PaletteQuery): Observable<PaletteResult[]>;
  /** Called whenever the palette opens: drop per-session caches (visibility gates, pages). */
  reset?(): void;
}

/** Multi-provider token for the palette sources: `{ provide: PALETTE_PROVIDERS, useClass: MyProvider, multi: true }`. */
export const PALETTE_PROVIDERS = new InjectionToken<PaletteProvider[]>('PALETTE_PROVIDERS');

/**
 * Where the palette reads the frecency of recently used results (the boost for rows with a
 * `recentKey`). Optional: without a source every frecency is 0. Read once per palette session.
 *
 * ```ts
 * { provide: PALETTE_RECENT_ITEMS_SOURCE, useFactory: () => {
 *     const recents = inject(RecentItemsService);
 *     return { frecencies: now => new Map(recents.items(now).map(i => [i.key, normalizedFrecency(i, now)])) };
 * } }
 * ```
 */
export interface PaletteRecentItemsSource {
  /** Normalised frecency 0…1 per `recentKey` at `now` (ms since epoch). */
  frecencies(now: number): ReadonlyMap<string, number>;
}

export const PALETTE_RECENT_ITEMS_SOURCE = new InjectionToken<PaletteRecentItemsSource>('PALETTE_RECENT_ITEMS_SOURCE');
