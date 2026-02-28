import { Directive, forwardRef, inject } from "@angular/core";
import {AssetRepoService, TenantDto} from '@meshmakers/octo-services';
import {DataSourceBase, DataSourceTyped, FetchResultTyped, ListViewComponent} from '@meshmakers/shared-ui';
import {from, Observable} from 'rxjs';
import {State} from '@progress/kendo-data-query/dist/npm/state';
import {map} from 'rxjs/operators';

@Directive({
  selector: "[appTenantDataSource]",
  providers:
    [
      {
        provide: DataSourceBase,
        useExisting: forwardRef(() => TenantsDataSourceDirective)
      }
    ]
})
export class TenantsDataSourceDirective extends DataSourceTyped<TenantDto> {
  private assetRepoService = inject(AssetRepoService);

  constructor() {
    const listViewComponent = inject(ListViewComponent);

    super(listViewComponent);
  }

  public override fetchData(queryOptions: {
    state: State;
    textSearch: string | null;
  }): Observable<FetchResultTyped<TenantDto> | null> {
    return from(this.assetRepoService.getTenants(queryOptions.state.skip ?? 0, queryOptions.state.take ?? 10)).pipe(map(v => {
        return new FetchResultTyped<TenantDto>(
          v?.list ?? [],
          v?.totalCount ?? 0
        );
      }
    ));
  }
}
