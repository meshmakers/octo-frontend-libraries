import { Directive, forwardRef, inject } from "@angular/core";
import {
  GetSdkMeteringPointDtoGQL,
  GetSdkMeteringPointQueryVariablesDto,
} from '../../graphQL/getSdkMeteringPoint';
import {Observable} from 'rxjs';
import {OctoGraphQlDataSource} from '@meshmakers/octo-ui';
import {DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent} from '@meshmakers/shared-ui';
import {GraphQL} from '@meshmakers/octo-services';
import {map} from 'rxjs/operators';

export interface MeteringPointDto {
  rtId: any;
  ckTypeId: any;
  name: string;
  meteringPointNumber: string;
  networkOperator?: string | null;
  operatingStatus: string;
}

@Directive({
  selector: "[appMeteringPointsDataSource]",
  exportAs: 'appMeteringPointsDataSource',
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => MeteringPointsDataSourceDirective)
    }
  ]
})
export class MeteringPointsDataSourceDirective extends OctoGraphQlDataSource<MeteringPointDto> {
  private readonly getSdkMeteringPointDtoGQL = inject(GetSdkMeteringPointDtoGQL);

  constructor() {
    const listViewComponent = inject(ListViewComponent);

    super(listViewComponent);

    this.searchFilterAttributePaths = ['name', 'meteringPointNumber'];
  }

  public override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<MeteringPointDto> | null> {

    const sort = this.getSortDefinitions(queryOptions.state);
    const searchFilterDto = this.getSearchFilterDefinitions(queryOptions.textSearch);
    const fieldFilters = this.getFieldFilterDefinitions(queryOptions.state);

    const v = {
      first: queryOptions.state.take,
      after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
      sort: sort,
      fieldFilters: fieldFilters,
      searchFilter: searchFilterDto
    } as GetSdkMeteringPointQueryVariablesDto;

    return this.getSdkMeteringPointDtoGQL.fetch(
      {variables: v, fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first'}
    ).pipe(map(v => {
      return new FetchResultTyped<MeteringPointDto>(
        v.data?.runtime?.octoSdkDemoMeteringPoint?.items ?? [],
        v.data?.runtime?.octoSdkDemoMeteringPoint?.totalCount ?? 0)
    }));
  }
}
