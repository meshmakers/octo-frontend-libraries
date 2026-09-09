import {State} from '@progress/kendo-data-query/dist/npm/state';
import {BehaviorSubject, Observable} from 'rxjs';
import {ListViewComponent} from '../list-view/list-view.component';
import {EventEmitter, signal} from '@angular/core';
import {FetchResult} from '../models/fetchResult';

export interface FetchDataOptions {
  state: State;
  textSearch: string | null;
  /** When true, bypass cache and fetch fresh data from the server */
  forceRefresh?: boolean;
}

export interface FetchAgainOptions {
  /**
   * Reset paging to page 1 before refetching. Pass `true` whenever the data
   * source's own filters (quick-view/bar filters outside the Kendo grid state)
   * changed: the result set changes, so the current page offset would point
   * into stale data or past the end — mirroring `notifyFilterChange()` and the
   * text-search path, which already reset the page.
   */
  resetSkip?: boolean;
}

export abstract class DataSourceBase {

  public readonly fetchAgainEvent = new EventEmitter<FetchAgainOptions | undefined>()

  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);

  /** Observable indicating if the data source is currently loading data */
  public readonly isLoading$ = this._isLoading$.asObservable();

  /** Current loading state */
  public get isLoading(): boolean {
    return this._isLoading$.value;
  }

  private readonly _totalCount = signal<number | null>(null);

  /**
   * Total row count reported by the last fetch (`null` before the first result).
   * Kept current by MmListViewDataBindingDirective; lets host pages show the
   * overall count (e.g. in a header badge) without a second query.
   */
  public readonly totalCount = this._totalCount.asReadonly();

  /** Set the total row count (called by MmListViewDataBindingDirective) */
  public setTotalCount(count: number | null): void {
    this._totalCount.set(count);
  }

  protected constructor(public readonly listViewComponent: ListViewComponent) {
  }

  /** Set the loading state (called by MmListViewDataBindingDirective) */
  public setLoading(loading: boolean): void {
    this._isLoading$.next(loading);
  }

  public fetchAgain(options?: FetchAgainOptions): void {
    this.fetchAgainEvent.emit(options);
  }

  /**
   * Whether a failed fetch means the requested page offset lies beyond the
   * (shrunken) result set. MmListViewDataBindingDirective then recovers by
   * resetting to page 1 and refetching once instead of silently keeping the
   * previous rows on screen. Protocol-specific subclasses (e.g. the OctoMesh
   * GraphQL data source) override this; the default cannot tell and says no.
   */
  public isPageOutOfRangeError(_error: unknown): boolean {
    return false;
  }

  public abstract fetchData(queryOptions: FetchDataOptions): Observable<FetchResult | null>;
}
