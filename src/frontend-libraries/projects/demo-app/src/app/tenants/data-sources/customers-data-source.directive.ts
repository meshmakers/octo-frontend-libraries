import { Directive, forwardRef, inject } from "@angular/core";
import {
  GetSdkCustomersDtoGQL,
  GetSdkCustomersQueryVariablesDto,
} from '../../graphQL/getSdkCustomers';
import {Observable} from 'rxjs';
import {OctoGraphQlDataSource} from '@meshmakers/octo-ui';
import {DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent} from '@meshmakers/shared-ui';
import {GraphQL} from '@meshmakers/octo-services';
import {OctoSdkDemoCustomerDto} from '../../graphQL/globalTypes';
import {map} from 'rxjs/operators';


@Directive({
  selector: "[appCustomersDataSource]",
  exportAs: 'appCustomersDataSource', // To be used in the template
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => CustomersDataSourceDirective)
    }
  ]
})
export class CustomersDataSourceDirective extends OctoGraphQlDataSource<OctoSdkDemoCustomerDto> {
  private readonly getSdkCustomersDtoGQL = inject(GetSdkCustomersDtoGQL);

  constructor() {
    const listViewComponent = inject(ListViewComponent);

    super(listViewComponent);

    this.searchFilterAttributePaths = ['firstName', 'lastName', 'city'];
  }

  public override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<OctoSdkDemoCustomerDto> | null> {

    const sort = this.getSortDefinitions(queryOptions.state);
    const searchFilterDto = this.getSearchFilterDefinitions(queryOptions.textSearch);
    const fieldFilters = this.getFieldFilterDefinitions(queryOptions.state);

    const v = {
      first: queryOptions.state.take,
      after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
      sort: sort,
      fieldFilters: fieldFilters,
      searchFilter: searchFilterDto
    } as GetSdkCustomersQueryVariablesDto;

    return this.getSdkCustomersDtoGQL.fetch(
      {variables: v, fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first'}
    ).pipe(map(v => {
      return new FetchResultTyped<OctoSdkDemoCustomerDto>(
        v.data?.runtime?.octoSdkDemoCustomer?.items ?? [],
        v.data?.runtime?.octoSdkDemoCustomer?.totalCount ?? 0)
    }));
  }
}
