import { Observable, from, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import {
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult,
  ColumnDefinition
} from '@meshmakers/shared-ui';
import { GetSystemPersistentQueriesDtoGQL } from '../../graphQL/getSystemPersistentQueries';
import { PersistentQueryItem } from '../../utils/runtime-entity-data-sources';

/**
 * Autocomplete data source for persistent query selection.
 * Filters queries by search text using GraphQL.
 */
export class PersistentQueryAutocompleteDataSource implements EntitySelectDataSource<PersistentQueryItem> {
  constructor(private gql: GetSystemPersistentQueriesDtoGQL) {}

  async onFilter(filter: string, take = 50): Promise<EntitySelectResult<PersistentQueryItem>> {
    const result = await firstValueFrom(
      this.gql.fetch({
        variables: {
          first: take,
          searchFilter: { searchTerm: filter, language: 'de' }
        }
      })
    );

    const items = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        name: item.name ?? '',
        description: item.description,
        queryCkTypeId: item.queryCkTypeId
      }));

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
 * Provides columns and paginated data for the entity select dialog.
 */
export class PersistentQueryDialogDataSource implements EntitySelectDialogDataSource<PersistentQueryItem> {
  constructor(private gql: GetSystemPersistentQueriesDtoGQL) {}

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
          searchFilter: options.textSearch ? { searchTerm: options.textSearch, language: 'de' } : undefined
        }
      })
    ).pipe(
      map(result => {
        const items = (result.data?.runtime?.systemPersistentQuery?.items ?? [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            rtId: item.rtId,
            name: item.name ?? '',
            description: item.description,
            queryCkTypeId: item.queryCkTypeId
          }));

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
