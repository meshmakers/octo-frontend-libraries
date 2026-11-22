import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkTypeAvailableQueryColumnsQueryVariablesDto = Exact<{
  after?: string | null | undefined;
  first?: number | null | undefined;
  rtCkId: string;
  filter?: string | null | undefined;
  attributeValueType?: Types.AttributeValueTypeDto | null | undefined;
  searchTerm?: string | null | undefined;
  includeNavigationProperties?: boolean | null | undefined;
  maxDepth?: number | null | undefined;
  attributePaths?: Array<string | null | undefined> | string | null | undefined;
  includeManyNavigations?: boolean | null | undefined;
}>;


export type GetCkTypeAvailableQueryColumnsQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any, ckTypeId: { fullName: string, semanticVersionedFullName: string }, availableQueryColumns: { totalCount: number | null, pageInfo: { hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null, endCursor: string | null }, items: Array<{ attributePath: string, attributeValueType: Types.AttributeValueTypeDto, description: string | null } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAvailableQueryColumnsDocumentDto = gql`
    query getCkTypeAvailableQueryColumns($after: String, $first: Int, $rtCkId: String!, $filter: String, $attributeValueType: AttributeValueType, $searchTerm: String, $includeNavigationProperties: Boolean, $maxDepth: Int, $attributePaths: [String], $includeManyNavigations: Boolean) {
  constructionKit {
    types(rtCkId: $rtCkId) {
      items {
        ckTypeId {
          fullName
          semanticVersionedFullName
        }
        rtCkTypeId
        availableQueryColumns(
          after: $after
          first: $first
          attributePathContains: $filter
          attributeValueType: $attributeValueType
          searchTerm: $searchTerm
          includeNavigationProperties: $includeNavigationProperties
          maxDepth: $maxDepth
          attributePaths: $attributePaths
          includeManyNavigations: $includeManyNavigations
        ) {
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          items {
            attributePath
            attributeValueType
            description
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
  export class GetCkTypeAvailableQueryColumnsDtoGQL extends Apollo.Query<GetCkTypeAvailableQueryColumnsQueryDto, GetCkTypeAvailableQueryColumnsQueryVariablesDto> {
    document = GetCkTypeAvailableQueryColumnsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }