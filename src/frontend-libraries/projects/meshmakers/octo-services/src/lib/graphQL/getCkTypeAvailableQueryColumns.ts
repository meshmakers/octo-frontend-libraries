import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypeAvailableQueryColumnsQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  rtCkId: Types.Scalars['String']['input'];
  filter?: Types.InputMaybe<Types.Scalars['String']['input']>;
  attributeValueType?: Types.InputMaybe<Types.AttributeValueTypeDto>;
  searchTerm?: Types.InputMaybe<Types.Scalars['String']['input']>;
  includeNavigationProperties?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  maxDepth?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCkTypeAvailableQueryColumnsQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', items?: Array<{ __typename?: 'CkType', rtCkTypeId: any, ckTypeId: { __typename?: 'CkTypeId', fullName: string, semanticVersionedFullName: string }, availableQueryColumns?: { __typename?: 'CkTypeQueryColumnDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null, endCursor?: string | null }, items?: Array<{ __typename?: 'CkTypeQueryColumn', attributePath: string, attributeValueType: Types.AttributeValueTypeDto, description?: string | null } | null> | null } | null } | null> | null } | null } | null };

export const GetCkTypeAvailableQueryColumnsDocumentDto = gql`
    query getCkTypeAvailableQueryColumns($after: String, $first: Int, $rtCkId: String!, $filter: String, $attributeValueType: AttributeValueType, $searchTerm: String, $includeNavigationProperties: Boolean, $maxDepth: Int) {
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