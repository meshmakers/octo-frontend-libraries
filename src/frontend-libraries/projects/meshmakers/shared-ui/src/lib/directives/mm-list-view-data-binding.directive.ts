import { ChangeDetectorRef, Directive, OnDestroy, OnInit, inject } from "@angular/core";
import {DataBindingDirective, DataStateChangeEvent, GridComponent} from "@progress/kendo-angular-grid";
import {CompositeFilterDescriptor} from "@progress/kendo-data-query";
import {Observable, of, Subscription} from "rxjs";
import {DataSourceBase, FetchAgainOptions} from "../data-sources/data-source-base";
import {ListStateService} from "../services/list-state.service";

@Directive({
  selector: "[mmListViewDataBinding]",
})
export class MmListViewDataBindingDirective extends DataBindingDirective implements OnInit, OnDestroy {
  private readonly dataSource = inject(DataSourceBase, { optional: true, skipSelf: true })!;
  private readonly listStateService = inject(ListStateService);

  /** Observable indicating if the data source is currently loading data */
  public get isLoading$(): Observable<boolean> {
    return this.dataSource?.isLoading$ ?? of(false);
  }

  /** Current loading state */
  public get isLoading(): boolean {
    return this.dataSource?.isLoading ?? false;
  }

  private _serviceSubscription: Subscription | null;
  private _executeFilterSubscription: Subscription | null;
  private _fetchAgainSubscription: Subscription | null;
  private _refreshDataSubscription: Subscription | null;
  private _textSearchValue: string | null = null;
  private _forceRefresh = false;

  constructor() {
    const grid = inject(GridComponent);
    const changeDetector = inject(ChangeDetectorRef);

    super(grid, changeDetector);
    this._serviceSubscription = null;
    this._executeFilterSubscription = null;
    this._fetchAgainSubscription = null;
    this._refreshDataSubscription = null;
  }

  public override ngOnInit(): void {
    super.ngOnInit();

    if (!this.dataSource) {
      return;
    }

    this._fetchAgainSubscription = this.dataSource.fetchAgainEvent.subscribe((options?: FetchAgainOptions) => {
      this._forceRefresh = true;
      // A data source refetching because its own (bar/quick-view) filters
      // changed must return to page 1 — same invariant as notifyFilterChange()
      // and the text-search path. A plain refresh keeps the current page.
      if (options?.resetSkip) {
        this.skip = 0;
      }
      this.rebind();
      if (options?.resetSkip) {
        this.persistState();
      }
    });

    this._executeFilterSubscription = this.dataSource.listViewComponent.onExecuteFilter.subscribe((value: string | null) => {
      this._textSearchValue = value;
      // A changed search term changes the result set — the current page offset
      // would point into stale data (or past the end), so return to page 1.
      this.skip = 0;
      this.rebind();
      this.persistState();
    });

    this._refreshDataSubscription = this.dataSource.listViewComponent.onRefreshData.subscribe(() => {
      this._forceRefresh = true;
      this.rebind();
    });

    // Restore the persisted sort/filter/page BEFORE the first fetch so the
    // initial rebind() already reflects the user's remembered view.
    this.restoreState();

    this.rebind();
  }

  public override ngOnDestroy(): void {
    this._serviceSubscription?.unsubscribe();
    this._executeFilterSubscription?.unsubscribe();
    this._fetchAgainSubscription?.unsubscribe();
    this._refreshDataSubscription?.unsubscribe();
    super.ngOnDestroy();
  }

  // noinspection JSUnusedGlobalSymbols

  /**
   * Triggers a rebind when the filter state changes programmatically.
   * Syncs the grid's filter into the DataBindingDirective state before rebinding.
   * Resets `skip` to page 1: a changed filter changes the result set, so the
   * current page offset would point into stale data or past the end (Kendo's
   * own filter-row path does the same reset via its dataStateChange event).
   */
  public notifyFilterChange(filter: CompositeFilterDescriptor): void {
    this.state.filter = filter;
    this.skip = 0;
    this.rebind();
    this.persistState();
  }

  /**
   * Applies a programmatic page-size change (fit-to-height mode of mm-list-view).
   * The inherited setters sync grid and query state; `skip` is realigned to the
   * new page grid so the pager stays on a valid page, then the data is refetched.
   */
  public applyPageSize(take: number): void {
    const skip = this.state.skip ?? 0;
    this.pageSize = take;
    this.skip = Math.floor(skip / take) * take;
    this.rebind();
    this.persistState();
  }

  /**
   * Kendo emits this for header-sort clicks, the built-in filter row and the
   * pager. Persist the resulting state so those interactions survive a revisit.
   */
  public override onStateChange(state: DataStateChangeEvent): void {
    super.onStateChange(state);
    this.persistState();
  }

  /** Effective per-list storage key, or null when persistence is disabled/unavailable. */
  private stateKey(): string | null {
    return this.dataSource?.listViewComponent?.resolveListStateKey() ?? null;
  }

  /**
   * Restores the persisted sort/filter/page into the grid state via the
   * inherited setters (which sync both the Kendo grid and the query state).
   * `take`/`pageSize` is intentionally not restored — it is the caller's
   * initial pageSize or the autoPageSize measurement.
   */
  private restoreState(): void {
    const key = this.stateKey();
    if (!key) {
      return;
    }
    const stored = this.listStateService.load(key);
    if (!stored) {
      return;
    }
    if (stored.sort) {
      this.sort = stored.sort;
    }
    if (stored.filter) {
      this.filter = stored.filter;
    }
    if (typeof stored.skip === "number") {
      this.skip = stored.skip;
    }
    if (stored.textSearch) {
      // Drive the fetch and mirror the value into the search box display.
      this._textSearchValue = stored.textSearch;
      this.dataSource?.listViewComponent?.restoreSearchValue(stored.textSearch);
    }
  }

  /**
   * Clears all filtering for this list back to the default view: row filter,
   * column sort, free-text search and page offset, and drops the persisted
   * entry (incl. any app-owned bar filters) so nothing is restored next visit.
   * The app-side bar filters are reset by the host via
   * {@link ListViewComponent.onResetFilters}.
   */
  public resetState(): void {
    this.sort = [];
    this.filter = { logic: "and", filters: [] };
    this.skip = 0;
    this._textSearchValue = null;
    const key = this.stateKey();
    if (key) {
      this.listStateService.clear(key);
    }
    this.rebind();
  }

  /** Writes the current sort/filter/skip + free-text search for this list to storage (best-effort). */
  private persistState(): void {
    const key = this.stateKey();
    if (!key) {
      return;
    }
    this.listStateService.save(key, this.state, this._textSearchValue);
  }

  public override rebind(): void {
    try {
      if (!this.dataSource) {
        return;
      }
      // Cancel a still-running fetch before starting a new one. Without this,
      // overlapping fetches (sort/page click while a load is in flight, or the
      // autoPageSize measurement refetch) race: whichever response arrives LAST
      // wins, so a stale response could overwrite newer data — e.g. an unsorted
      // page replacing the sorted one the user just requested.
      this._serviceSubscription?.unsubscribe();
      // Only use dataSource.setLoading() (tracked via isLoading$ / isLoading signal).
      // Do NOT set grid.loading directly — it triggers Kendo's internal loading overlay.
      this.dataSource.setLoading(true);
      const forceRefresh = this._forceRefresh;
      this._forceRefresh = false; // Reset for next call

      this._serviceSubscription = this.dataSource.fetchData({
        state: this.state,
        textSearch: this._textSearchValue,
        forceRefresh
      }).subscribe({
        next: value => {
          this.dataSource.setLoading(false);
          this.dataSource.setTotalCount(value?.totalCount ?? 0);
          this.grid.data = {
            data: (value?.data ?? []) as unknown[],
            total: value?.totalCount || 0
          }
          this.notifyDataChange();
        },
        error: (err) => {
          console.error('[MmListViewDataBinding] fetchData error:', err);
          this.dataSource.setLoading(false);
          // A restored/stale page offset can lie beyond the current result set
          // (persisted skip + changed filters, or data shrunk since the last
          // visit) — the server rejects the fetch and the grid would silently
          // keep showing the PREVIOUS rows under the NEW filters. Recover by
          // returning to page 1 once; skip === 0 cannot be out of range, so
          // this cannot loop.
          if ((this.state.skip ?? 0) > 0 && this.dataSource.isPageOutOfRangeError(err)) {
            this.skip = 0;
            this._forceRefresh = true;
            this.rebind();
            this.persistState();
          }
        }
      });
    } catch (e) {
      console.error('[MmListViewDataBinding] rebind() caught error:', e);
      this.dataSource.setLoading(false);
    }
  }
}
