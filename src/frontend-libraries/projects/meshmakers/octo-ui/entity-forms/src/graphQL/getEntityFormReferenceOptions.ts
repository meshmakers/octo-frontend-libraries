import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetReferenceOptionsQueryVariablesDto = Exact<{
  ckTypeId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type EntityFormGetReferenceOptionsQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, pageInfo: { endCursor: string | null, hasNextPage: boolean }, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, rtDisplayDescription: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetReferenceOptionsDocumentDto = gql`
    query entityFormGetReferenceOptions($ckTypeId: String!, $first: Int, $after: String, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      first: $first
      after: $after
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
        ckTypeId
        rtWellKnownName
        rtDisplayName
        attributes(attributeNames: ["name"]) {
          items {
            attributeName
            value
          }
        }
        rtDisplayDescription
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetReferenceOptionsDtoGQL extends Apollo.Query<EntityFormGetReferenceOptionsQueryDto, EntityFormGetReferenceOptionsQueryVariablesDto> {
    document = EntityFormGetReferenceOptionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }