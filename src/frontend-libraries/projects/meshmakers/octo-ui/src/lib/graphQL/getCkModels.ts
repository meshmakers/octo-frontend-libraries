import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkModelsQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
  ckId?: string | null | undefined;
}>;


export type GetCkModelsQueryDto = { constructionKit: { models: { totalCount: number | null, items: Array<{ modelState: Types.ModelStateDto | null, id: { name: string, version: any, fullName: string, semanticVersionedFullName: string }, dependencies: Array<{ fullName: string }> } | null> | null } | null } | null };

export const GetCkModelsDocumentDto = gql`
    query getCkModels($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort], $ckId: String) {
  constructionKit {
    models(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
      ckId: $ckId
    ) {
      totalCount
      items {
        id {
          name
          version
          fullName
          semanticVersionedFullName
        }
        modelState
        dependencies {
          fullName
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkModelsDtoGQL extends Apollo.Query<GetCkModelsQueryDto, GetCkModelsQueryVariablesDto> {
    document = GetCkModelsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }