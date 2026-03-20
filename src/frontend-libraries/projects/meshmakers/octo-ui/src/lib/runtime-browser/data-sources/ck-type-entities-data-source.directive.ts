import { Directive, forwardRef, inject } from '@angular/core';
import { GraphQL, RtEntityDto } from '@meshmakers/octo-services';
import {
  DataSourceBase,
  FetchDataOptions,
  FetchResultTyped,
  ListViewComponent,
} from '@meshmakers/shared-ui';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { OctoGraphQlDataSource } from '../../data-sources/octo-graph-ql-data-source';
import { GetRuntimeEntitiesByTypeDtoGQL } from '../../graphQL/getRuntimeEntitiesByType';

@Directive({
  selector: '[mmCkTypeEntitiesDataSource]',
  exportAs: 'mmCkTypeEntitiesDataSource',
  standalone: true,
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => CkTypeEntitiesDataSourceDirective),
    },
  ],
})
export class CkTypeEntitiesDataSourceDirective extends OctoGraphQlDataSource<RtEntityDto> {
  private readonly getRuntimeEntitiesGQL = inject(
    GetRuntimeEntitiesByTypeDtoGQL,
  );
  private ckTypeId: string | null = null;

  constructor() {
    const listViewComponent = inject(ListViewComponent);
    super(listViewComponent);
    console.debug('CkTypeEntitiesDataSource: Constructor called');
  }

  public setRtCkTypeId(ckTypeId: string): void {
    console.debug('CkTypeEntitiesDataSource: Setting CK Type ID:', ckTypeId);
    this.ckTypeId = ckTypeId;
    // Trigger a refresh to tell the ListViewComponent to fetch data again
    this.fetchAgain();
  }

  public fetchData(
    queryOptions: FetchDataOptions,
  ): Observable<FetchResultTyped<RtEntityDto> | null> {
    console.debug(
      'CkTypeEntitiesDataSource: fetchData called with ckTypeId:',
      this.ckTypeId,
    );

    if (!this.ckTypeId) {
      // Return empty result if no type ID is set
      console.debug(
        'CkTypeEntitiesDataSource: No CK Type ID set, returning empty result',
      );
      return of(new FetchResultTyped<RtEntityDto>([], 0));
    }

    const sort = this.getSortDefinitions(queryOptions.state);
    const fieldFilters = this.getFieldFilterDefinitions(queryOptions.state);

    const variables = {
      ckTypeId: this.ckTypeId,
      first: queryOptions.state.take,
      after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
      sort: sort,
      fieldFilters: fieldFilters,
    };

    console.debug(
      'CkTypeEntitiesDataSource: Making GraphQL request with variables:',
      variables,
    );

    return this.getRuntimeEntitiesGQL
      .fetch({
        variables: variables,
        fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first',
      })
      .pipe(
        map((result) => {
          console.debug('CkTypeEntitiesDataSource: GraphQL response:', result);
          const items = result.data?.runtime?.runtimeEntities?.items ?? [];
          const totalCount =
            result.data?.runtime?.runtimeEntities?.totalCount ?? 0;

          // Transform and filter out null items
          const transformedItems = items
            .filter((item): item is NonNullable<typeof item> => item != null)
            .map((item) => ({
              rtId: item.rtId || '',
              ckTypeId: item.ckTypeId || this.ckTypeId || '',
              rtWellKnownName: item.rtWellKnownName || null,
              rtCreationDateTime: item.rtCreationDateTime || null,
              rtChangedDateTime: item.rtChangedDateTime || null,
            })) as RtEntityDto[];

          console.debug(
            'CkTypeEntitiesDataSource: Returning',
            transformedItems.length,
            'items',
          );

          return new FetchResultTyped<RtEntityDto>(
            transformedItems,
            totalCount,
          );
        }),
      );
  }
}
