import {DataSourceBase, FetchDataOptions} from "./data-source-base";
import {ListViewComponent} from "../list-view/list-view.component";
import {Observable} from "rxjs";
import {FetchResultTyped} from '../models/fetchResult';

export abstract class DataSourceTyped<TDto> extends DataSourceBase {

  // noinspection JSUnusedGlobalSymbols
  protected constructor(mmTableComponent: ListViewComponent) {
    super(mmTableComponent);
  }

  public abstract override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<TDto> | null>;
}
