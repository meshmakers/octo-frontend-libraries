import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetRuntimeEntitiesByTypeQueryVariablesDto = Exact<{
  ckTypeId: string;
  after?: string | null | undefined;
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetRuntimeEntitiesByTypeQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, pageInfo: { endCursor: string | null, hasNextPage: boolean }, items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, rtCreationDateTime: any, rtChangedDateTime: any } | null> | null } | null } | null };

export const GetRuntimeEntitiesByTypeDocumentDto = gql`
    query getRuntimeEntitiesByType($ckTypeId: String!, $after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
    ) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      items {
        rtId
        rtDisplayName
        rtDisplayDescription
        ckTypeId
        rtWellKnownName
        rtCreationDateTime
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetRuntimeEntitiesByTypeDtoGQL extends Apollo.Query<GetRuntimeEntitiesByTypeQueryDto, GetRuntimeEntitiesByTypeQueryVariablesDto> {
    document = GetRuntimeEntitiesByTypeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }