import { Directive, forwardRef, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DataSourceBase, FetchDataOptions, FetchResult, FetchResultBase, ListViewComponent } from '@meshmakers/shared-ui';

@Directive({
  selector: '[appEmptyDataSource]',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => EmptyDataSourceDirective) }]
})
export class EmptyDataSourceDirective extends DataSourceBase {
  constructor() {
    super(inject(ListViewComponent));
  }

  public fetchData(_options: FetchDataOptions): Observable<FetchResult | null> {
    const noRows: unknown[] = [];
    return of(new FetchResultBase(noRows, noRows.length));
  }
}
