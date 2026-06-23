import { Observable, from, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import {
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult,
  ColumnDefinition
} from '@meshmakers/shared-ui';
import { FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';
import { QueryFamily, queryFamily } from '../../utils/query-family';

/**
 * Filter the result list down to queries whose family is in the accept list.
 * Family is classified by the persistent-query entity's own CK type
 * (`ckTypeId`, e.g. `RtSimpleSdQuery`) — NOT the target type
 * (`queryCkTypeId`, e.g. `Basic.Energy/EnergyMeasurement`), which has nothing
 * to do with runtime vs stream-data.
 *
 * `null` family (unrecognised legacy query type) is kept only when 'runtime'
 * is among the accepted families — historical behavior treated everything as
 * runtime-compatible.
 */
function filterByFamily(items: PersistentQueryItem[], accept: readonly QueryFamily[]): PersistentQueryItem[] {
  if (accept.length === 0) {
    return items;
  }
  return items.filter(item => {
    const family = queryFamily(item.ckTypeId);
    if (family === null) {
      return accept.includes('runtime');
    }
    return accept.includes(family);
  });
}

/**
 * Autocomplete data source for persistent query selection.
 * Filters queries by search text using GraphQL, then narrows by family on the client.
 */
export class PersistentQueryAutocompleteDataSource implements EntitySelectDataSource<PersistentQueryItem> {
  constructor(
    private gql: GetSystemPersistentQueriesDtoGQL,
    private acceptFamilies: readonly QueryFamily[] = ['runtime', 'streamData']
  ) {}

  async onFilter(filter: string, take = 50): Promise<EntitySelectResult<PersistentQueryItem>> {
    const result = await firstValueFrom(
      this.gql.fetch({
        variables: {
          first: take,
          fieldFilters: filter ? [{ attributePath: 'name', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: filter }] : undefined
        }
      })
    );

    const rawItems = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        name: item.name ?? '',
        description: item.description,
        ckTypeId: item.ckTypeId,
        queryCkTypeId: item.queryCkTypeId
      }));

    const items = filterByFamily(rawItems, this.acceptFamilies);

    return {
      totalCount: result.data?.runtime?.systemPersistentQuery?.totalCount ?? 0,
      items
    };
  }

  onDisplayEntity(entity: PersistentQueryItem): string {
    return entity.name;
  }

  getIdEntity(entity: PersistentQueryItem): string {
    return entity.rtId;
  }
}

/**
 * Dialog data source for persistent query selection grid.
 * Provides columns and paginated data for the entity select dialog, narrowed by family on the client.
 */
export class PersistentQueryDialogDataSource implements EntitySelectDialogDataSource<PersistentQueryItem> {
  constructor(
    private gql: GetSystemPersistentQueriesDtoGQL,
    private acceptFamilies: readonly QueryFamily[] = ['runtime', 'streamData']
  ) {}

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'name', displayName: 'Name', dataType: 'text' },
      { field: 'description', displayName: 'Description', dataType: 'text' },
      { field: 'queryCkTypeId', displayName: 'CK Type', dataType: 'text' }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<PersistentQueryItem>> {
    return from(
      this.gql.fetch({
        variables: {
          first: options.take,
          after: options.skip > 0 ? btoa(`arrayconnection:${options.skip - 1}`) : undefined,
          fieldFilters: options.textSearch ? [{ attributePath: 'name', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: options.textSearch }] : undefined
        }
      })
    ).pipe(
      map(result => {
        const rawItems = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            rtId: item.rtId,
            name: item.name ?? '',
            description: item.description,
            queryCkTypeId: item.queryCkTypeId
          }));

        const items = filterByFamily(rawItems, this.acceptFamilies);

        return {
          data: items,
          totalCount: result.data?.runtime?.systemPersistentQuery?.totalCount ?? 0
        };
      })
    );
  }

  onDisplayEntity(entity: PersistentQueryItem): string {
    return entity.name;
  }

  getIdEntity(entity: PersistentQueryItem): string {
    return entity.rtId;
  }
}
