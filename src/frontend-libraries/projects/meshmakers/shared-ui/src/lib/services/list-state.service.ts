import { Injectable } from '@angular/core';
import {
  CompositeFilterDescriptor,
  FilterDescriptor,
  SortDescriptor,
  State,
  isCompositeFilterDescriptor,
} from '@progress/kendo-data-query';

/**
 * The slice of a Kendo grid {@link State} that is worth persisting for a list
 * view: the user's sort, row filter and current page offset. `take`/`pageSize`
 * is deliberately excluded — in `autoPageSize` mode it is re-derived from the
 * viewport on every load, so persisting it is pointless (and restoring it would
 * fight the measurement).
 */
export interface PersistedListState {
  sort?: SortDescriptor[];
  filter?: CompositeFilterDescriptor;
  skip?: number;
  /** Free-text "search all columns" value — lives outside the Kendo state. */
  textSearch?: string | null;
  /**
   * App-owned extra state stored under the same list key — e.g. the coarse
   * "quick view" / bar filters (category, view, date range) that live in app
   * signals rather than the Kendo grid state. Opaque to this service; the host
   * app defines the shape. Written via {@link ListStateService.saveExtra} and
   * preserved by the directive's own {@link ListStateService.save}.
   */
  extra?: unknown;
}

/** Matches ISO-8601 date/date-time strings that JSON.stringify produces from a Date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Persists list-view sort/filter/paging per list so users do not have to
 * re-apply them on every visit. Central to shared-ui so every app gets the
 * behaviour for free (see {@link ListViewComponent.listStateKey}).
 *
 * Storage is a single namespaced blob in localStorage (survives reloads and
 * browser restarts), keyed by list — mirroring {@link WindowStateService}'s
 * `mm-window-states` map pattern. Every access is guarded: a corrupt or
 * unavailable store must never break a list, it just falls back to no state.
 */
@Injectable({ providedIn: 'root' })
export class ListStateService {
  private readonly storageKey = 'mm-list-view-state';

  /** Returns the persisted state for `key`, with date filter values re-hydrated to `Date`. */
  load(key: string): PersistedListState | null {
    const all = this.loadAll();
    const entry = all[key];
    if (!entry) {
      return null;
    }
    // JSON round-trips Date -> ISO string; the Kendo date filter cell needs a
    // real Date back or date filtering/display breaks after restore.
    if (entry.filter) {
      this.reviveFilterDates(entry.filter);
    }
    return entry;
  }

  /**
   * Stores the sort/filter/skip slice of `state` for `key` plus the free-text
   * search (which lives outside the Kendo state). `take` is intentionally dropped.
   */
  save(key: string, state: State, textSearch?: string | null): void {
    const all = this.loadAll();
    all[key] = {
      // Preserve any app-owned `extra` (bar filters) written via saveExtra().
      ...all[key],
      sort: state.sort,
      filter: state.filter,
      skip: state.skip,
      textSearch: textSearch ?? null,
    };
    this.saveAll(all);
  }

  /**
   * Stores app-owned extra state (e.g. quick-view/bar filters) under `key`,
   * merging into the same entry as the grid state without clobbering it.
   */
  saveExtra(key: string, extra: unknown): void {
    const all = this.loadAll();
    all[key] = { ...all[key], extra };
    this.saveAll(all);
  }

  /** Returns the app-owned extra state stored under `key`, or null. */
  loadExtra<T>(key: string): T | null {
    const all = this.loadAll();
    return (all[key]?.extra as T) ?? null;
  }

  /** Drops the stored state for `key`. */
  clear(key: string): void {
    const all = this.loadAll();
    if (key in all) {
      delete all[key];
      this.saveAll(all);
    }
  }

  private reviveFilterDates(filter: CompositeFilterDescriptor): void {
    for (const f of filter.filters) {
      if (isCompositeFilterDescriptor(f)) {
        this.reviveFilterDates(f);
        continue;
      }
      const leaf = f as FilterDescriptor;
      if (typeof leaf.value === 'string' && ISO_DATE.test(leaf.value)) {
        const parsed = new Date(leaf.value);
        if (!Number.isNaN(parsed.getTime())) {
          leaf.value = parsed;
        }
      }
    }
  }

  private loadAll(): Record<string, PersistedListState> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as Record<string, PersistedListState>) : {};
    } catch {
      return {};
    }
  }

  private saveAll(all: Record<string, PersistedListState>): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(all));
    } catch {
      // localStorage full or unavailable — persistence is best-effort.
    }
  }
}
