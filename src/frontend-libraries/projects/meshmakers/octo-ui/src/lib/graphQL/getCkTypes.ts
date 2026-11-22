import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypesQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
  ckModelIds?: Array<string | null | undefined> | string | null | undefined;
}>;


export type GetCkTypesQueryDto = { constructionKit: { types: { totalCount: number | null, items: Array<{ rtCkTypeId: any, isAbstract: boolean, isFinal: boolean, baseType: { isAbstract: boolean, isFinal: boolean, ckTypeId: { fullName: string, semanticVersionedFullName: string } } | null, ckTypeId: { fullName: string, semanticVersionedFullName: string } } | null> | null } | null } | null };

export const GetCkTypesDocumentDto = gql`
    query getCkTypes($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort], $ckModelIds: [String]) {
  constructionKit {
    types(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
      ckModelIds: $ckModelIds
    ) {
      totalCount
      items {
        baseType {
          ckTypeId {
            fullName
            semanticVersionedFullName
          }
          isAbstract
          isFinal
        }
        ckTypeId {
          fullName
          semanticVersionedFullName
        }
        rtCkTypeId
        isAbstract
        isFinal
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypesDtoGQL extends Apollo.Query<GetCkTypesQueryDto, GetCkTypesQueryVariablesDto> {
    document = GetCkTypesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }