import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetReferenceOptionsQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type EntityFormGetReferenceOptionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtDisplayName: string, rtDisplayDescription?: string | null } | null> | null } | null } | null };

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