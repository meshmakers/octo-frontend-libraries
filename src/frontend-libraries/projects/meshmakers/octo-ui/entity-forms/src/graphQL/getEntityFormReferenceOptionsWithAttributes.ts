import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetReferenceOptionsWithAttributesQueryVariablesDto = Exact<{
  ckTypeId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
  attributeNames: Array<string | null | undefined> | string;
}>;


export type EntityFormGetReferenceOptionsWithAttributesQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, pageInfo: { endCursor: string | null, hasNextPage: boolean }, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, rtDisplayDescription: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetReferenceOptionsWithAttributesDocumentDto = gql`
    query entityFormGetReferenceOptionsWithAttributes($ckTypeId: String!, $first: Int, $after: String, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort], $attributeNames: [String]!) {
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
        rtDisplayDescription
        attributes(attributeNames: $attributeNames) {
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
  export class EntityFormGetReferenceOptionsWithAttributesDtoGQL extends Apollo.Query<EntityFormGetReferenceOptionsWithAttributesQueryDto, EntityFormGetReferenceOptionsWithAttributesQueryVariablesDto> {
    document = EntityFormGetReferenceOptionsWithAttributesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }