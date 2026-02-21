import {State} from "@progress/kendo-data-query/dist/npm/state";
import {BehaviorSubject, Observable} from "rxjs";
import {ListViewComponent} from '../list-view/list-view.component';
import {EventEmitter} from '@angular/core';
import {FetchResult} from '../models/fetchResult';

export interface FetchDataOptions {
  state: State;
  textSearch: string | null;
  /** When true, bypass cache and fetch fresh data from the server */
  forceRefresh?: boolean;
}

export abstract class DataSourceBase {

  public readonly fetchAgainEvent = new EventEmitter<void>()

  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);

  /** Observable indicating if the data source is currently loading data */
  public readonly isLoading$ = this._isLoading$.asObservable();

  /** Current loading state */
  public get isLoading(): boolean {
    return this._isLoading$.value;
  }

  protected constructor(public readonly listViewComponent: ListViewComponent) {
  }

  /** Set the loading state (called by MmListViewDataBindingDirective) */
  public setLoading(loading: boolean): void {
    this._isLoading$.next(loading);
  }

  public fetchAgain(): void {
    this.fetchAgainEvent.emit();
  }

  public abstract fetchData(queryOptions: FetchDataOptions): Observable<FetchResult | null>;
}
