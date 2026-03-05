import { ChangeDetectorRef, Directive, OnDestroy, OnInit, inject } from "@angular/core";
import {DataBindingDirective, GridComponent} from "@progress/kendo-angular-grid";
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

  public override rebind(): void {
    try {
      if (!this.dataSource) {
        return;
      }
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
