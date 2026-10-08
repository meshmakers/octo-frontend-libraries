import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetReferenceOptionsWithAttributesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
  attributeNames: Array<Types.InputMaybe<Types.Scalars['String']['input']>> | Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type EntityFormGetReferenceOptionsWithAttributesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtDisplayName: string, rtDisplayDescription?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null };

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