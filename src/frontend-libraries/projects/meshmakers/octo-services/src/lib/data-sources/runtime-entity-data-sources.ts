import { Observable, from, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { EntitySelectDataSource, EntitySelectResult } from '@meshmakers/shared-services';
import {
  EntitySelectDialogDataSource,
  DialogFetchOptions,
  DialogFetchResult,
  ColumnDefinition
} from '@meshmakers/shared-ui';
import { FieldFilterOperatorsDto } from '../graphQL/globalTypes';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';

/**
 * Represents a runtime entity for selection in config dialogs
 */
export interface RuntimeEntityItem {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string;
  displayName: string;
}

/**
 * Data source for entity autocomplete input - filters entities by CK Type
 */
export class RuntimeEntitySelectDataSource implements EntitySelectDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  async onFilter(filter: string, take?: number): Promise<EntitySelectResult<RuntimeEntityItem>> {
    const result = await firstValueFrom(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: take ?? 10,
          fieldFilters: [
            { attributePath: 'rtId', operator: FieldFilterOperatorsDto.LikeDto, comparisonValue: filter }
          ]
        }
      })
    );

    const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        ckTypeId: item.ckTypeId,
        rtWellKnownName: item.rtWellKnownName ?? undefined,
        displayName: item.rtWellKnownName || item.rtId
      }));

    return {
      totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0,
      items
    };
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}

/**
 * Dialog data source for entity selection grid with pagination and search
 */
export class RuntimeEntityDialogDataSource implements EntitySelectDialogDataSource<RuntimeEntityItem> {
  constructor(
    private getEntitiesByCkTypeGQL: GetEntitiesByCkTypeDtoGQL,
    private ckTypeId: string
  ) {}

  getColumns(): ColumnDefinition[] {
    return [
      { field: 'rtId', displayName: 'RT-ID' },
      { field: 'rtWellKnownName', displayName: 'Name' },
      { field: 'ckTypeId', displayName: 'CK Type' }
    ];
  }

  fetchData(options: DialogFetchOptions): Observable<DialogFetchResult<RuntimeEntityItem>> {
    const fieldFilters: { attributePath: string; operator: FieldFilterOperatorsDto; comparisonValue: string }[] = [];
    if (options.textSearch && options.textSearch.trim()) {
      fieldFilters.push({
        attributePath: 'rtId',
        operator: FieldFilterOperatorsDto.LikeDto,
        comparisonValue: options.textSearch.trim()
      });
    }

    return from(
      this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId: this.ckTypeId,
          first: options.take,
          after: options.skip > 0 ? btoa(`arrayconnection:${options.skip - 1}`) : undefined,
          fieldFilters: fieldFilters.length > 0 ? fieldFilters : undefined
        }
      })
    ).pipe(
      map(result => {
        const items = (result.data?.runtime?.runtimeEntities?.items ?? [])
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => ({
            rtId: item.rtId,
            ckTypeId: item.ckTypeId,
            rtWellKnownName: item.rtWellKnownName ?? undefined,
            displayName: item.rtWellKnownName || item.rtId
          }));

        return {
          data: items,
          totalCount: result.data?.runtime?.runtimeEntities?.totalCount ?? 0
        };
      })
    );
  }

  onDisplayEntity(entity: RuntimeEntityItem): string {
    return entity.displayName;
  }

  getIdEntity(entity: RuntimeEntityItem): string {
    return entity.rtId;
  }
}
