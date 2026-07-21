import { ChangeDetectorRef, Directive, OnDestroy, OnInit, inject } from "@angular/core";
import {DataBindingDirective, GridComponent} from "@progress/kendo-angular-grid";
import {CompositeFilterDescriptor} from "@progress/kendo-data-query";
import {Observable, of, Subscription} from "rxjs";
import {DataSourceBase} from "../data-sources/data-source-base";

@Directive({
  selector: "[mmListViewDataBinding]",
})
export class MmListViewDataBindingDirective extends DataBindingDirective implements OnInit, OnDestroy {
  private readonly dataSource = inject(DataSourceBase, { optional: true, skipSelf: true })!;

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

    this._fetchAgainSubscription = this.dataSource.fetchAgainEvent.subscribe(() => {
      this._forceRefresh = true;
      this.rebind();
    });

    this._executeFilterSubscription = this.dataSource.listViewComponent.onExecuteFilter.subscribe((value: string | null) => {
      this._textSearchValue = value;
      // A changed search term changes the result set — the current page offset
      // would point into stale data (or past the end), so return to page 1.
      this.skip = 0;
      this.rebind();
    });

    this._refreshDataSubscription = this.dataSource.listViewComponent.onRefreshData.subscribe(() => {
      this._forceRefresh = true;
      this.rebind();
    });

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
        }
      });
    } catch (e) {
      console.error('[MmListViewDataBinding] rebind() caught error:', e);
      this.dataSource.setLoading(false);
    }
  }
}
