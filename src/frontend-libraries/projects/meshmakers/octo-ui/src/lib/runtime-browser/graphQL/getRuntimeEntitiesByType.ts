import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetRuntimeEntitiesByTypeQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetRuntimeEntitiesByTypeQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

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