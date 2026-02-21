import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GetCkTypesDtoGQL, GetCkTypesQueryDto } from '../graphQL/getCkTypes';
import { GetCkTypeByRtCkTypeIdDtoGQL } from '../graphQL/getCkTypeByRtCkTypeId';
import { SearchFilterTypesDto } from '../graphQL/globalTypes';
import { GraphQL } from '../shared/graphQL';

type CkTypeItemDto = NonNullable<NonNullable<NonNullable<NonNullable<GetCkTypesQueryDto['constructionKit']>['types']>['items']>[number]>;

export interface CkTypeSelectorItem {
  /* The full name CK type ID, e.g., "OctoSdkDemo-1.0.0/Customer-1" */
  fullName: string;
  /* The runtime CK type ID for runtime queries, e.g., "OctoSdkDemo-1.0.0/Customer" */
  rtCkTypeId: string;
  /* The full name CK type ID of the base type, if any */
  baseTypeFullName?: string;
  /* The runtime CK type ID of the base type, if any */
  baseTypeRtCkTypeId?: string;
  /* Indicates if the type is abstract */
  isAbstract: boolean;
  /* Indicates if the type is final */
  isFinal: boolean;
  /* Optional description of the CK type */
  description?: string;
}

export interface CkTypeSelectorResult {
  items: CkTypeSelectorItem[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CkTypeSelectorService {
  private readonly getCkTypesGQL = inject(GetCkTypesDtoGQL);
  private readonly getCkTypeByRtCkTypeIdGQL = inject(GetCkTypeByRtCkTypeIdDtoGQL);

  /**
   * Get a CkType by its rtCkTypeId
   * @param rtCkTypeId The runtime CK type ID, e.g., "OctoSdkDemo-1.0.0/Customer"
   * @returns Observable of CkTypeSelectorItem or null if not found
   */
  public getCkTypeByRtCkTypeId(rtCkTypeId: string): Observable<CkTypeSelectorItem | null> {
    return this.getCkTypeByRtCkTypeIdGQL.fetch({
      variables: { rtCkTypeId },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const items = result.data?.constructionKit?.types?.items;
        if (!items || items.length === 0) {
          return null;
        }

        const item = items[0];
        if (!item) {
          return null;
        }

        // Note: This query returns minimal data, so we only have ckTypeId info
        return {
          fullName: item.ckTypeId.fullName,
          rtCkTypeId: item.rtCkTypeId,
          isAbstract: false,
          isFinal: false
        };
      })
    );
  }

  /**
   * Get CkTypes with optional filtering by model IDs and search text
   * @param options Search options
   * @returns Observable of CkTypeSelectorResult
   */
  public getCkTypes(options: {
    ckModelIds?: string[];
    searchText?: string;
    first?: number;
    skip?: number;
  } = {}): Observable<CkTypeSelectorResult> {
    const { ckModelIds, searchText, first = 50, skip = 0 } = options;

    return this.getCkTypesGQL.fetch({
      variables: {
        ckModelIds: ckModelIds && ckModelIds.length > 0 ? ckModelIds : null,
        first: first,
        after: GraphQL.offsetToCursor(skip),
        searchFilter: searchText ? {
          type: SearchFilterTypesDto.AttributeFilterDto,
          attributePaths: ['ckTypeId'],
          searchTerm: searchText
        } : null
      },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        const types = result.data?.constructionKit?.types;
        if (!types) {
          return { items: [], totalCount: 0 };
        }

        const items = (types.items || [])
          .filter((item): item is CkTypeItemDto => item !== null)
          .map(item => this.mapToSelectorItem(item));

        return {
          items,
          totalCount: types.totalCount || 0
        };
      })
    );
  }

  private mapToSelectorItem(item: CkTypeItemDto): CkTypeSelectorItem {
    return {
      fullName: item.ckTypeId.fullName,
      rtCkTypeId: item.rtCkTypeId,
      baseTypeFullName: item.baseType?.ckTypeId.fullName,
      baseTypeRtCkTypeId: item.baseType?.rtCkTypeId,
      isAbstract: item.isAbstract,
      isFinal: item.isFinal,
      description: item.description ?? undefined
    };
  }
}
