import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetEntitiesByCkTypeQueryVariablesDto = Exact<{
  ckTypeId: string;
  attributeNames: Array<string> | string;
  rtId?: any;
  after?: string | null | undefined;
  first?: number | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetEntitiesByCkTypeQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, rtDisplayDescription: string | null, rtCreationDateTime: any, rtChangedDateTime: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null };

export const GetEntitiesByCkTypeDocumentDto = gql`
    query getEntitiesByCkType($ckTypeId: String!, $attributeNames: [String!]!, $rtId: OctoObjectId, $after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      rtId: $rtId
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
        rtWellKnownName
        rtDisplayName
        rtDisplayDescription
        rtCreationDateTime
        rtChangedDateTime
        attributes(attributeNames: $attributeNames, resolveEnumValuesToNames: true) {
          items {
            attributeName
            value
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetEntitiesByCkTypeDtoGQL extends Apollo.Query<GetEntitiesByCkTypeQueryDto, GetEntitiesByCkTypeQueryVariablesDto> {
    document = GetEntitiesByCkTypeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }