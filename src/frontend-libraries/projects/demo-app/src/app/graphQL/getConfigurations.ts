import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetConfigurationsQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  rtIds?: Array<any> | any | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetConfigurationsQueryDto = { runtime: { systemConfiguration: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null } | null> | null } | null } | null };

export const GetConfigurationsDocumentDto = gql`
    query getConfigurations($after: String, $first: Int, $rtIds: [OctoObjectId], $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    systemConfiguration(
      after: $after
      first: $first
      rtIds: $rtIds
      searchFilter: $searchFilter
      fieldFilter: $fieldFilters
      sortOrder: $sort
    ) {
      totalCount
      items {
        rtId
        ckTypeId
        rtWellKnownName
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetConfigurationsDtoGQL extends Apollo.Query<GetConfigurationsQueryDto, GetConfigurationsQueryVariablesDto> {
    document = GetConfigurationsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }