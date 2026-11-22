import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSystemPersistentQueriesQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetSystemPersistentQueriesQueryDto = { runtime: { systemPersistentQuery: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, queryCkTypeId: string } | null> | null } | null } | null };

export const GetSystemPersistentQueriesDocumentDto = gql`
    query getSystemPersistentQueries($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    systemPersistentQuery(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
    ) {
      totalCount
      items {
        rtId
        ckTypeId
        name
        description
        queryCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSystemPersistentQueriesDtoGQL extends Apollo.Query<GetSystemPersistentQueriesQueryDto, GetSystemPersistentQueriesQueryVariablesDto> {
    document = GetSystemPersistentQueriesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }