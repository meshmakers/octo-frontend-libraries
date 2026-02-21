import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSystemPersistentQueriesQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetSystemPersistentQueriesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemPersistentQuery?: { __typename?: 'SystemPersistentQueryConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemPersistentQuery', rtId: any, ckTypeId: any, name: string, description?: string | null, queryCkTypeId: string } | null> | null } | null } | null };

export const GetSystemPersistentQueriesDocumentDto = gql`
    query getSystemPersistentQueries($after: String, $first: Int, $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    systemPersistentQuery(
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
        name
        description
        queryCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSystemPersistentQueriesDtoGQL extends Apollo.Query<GetSystemPersistentQueriesQueryDto, GetSystemPersistentQueriesQueryVariablesDto> {
    document = GetSystemPersistentQueriesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }