import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetConfigurationsQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  rtIds?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>> | Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetConfigurationsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemConfiguration?: { __typename?: 'SystemConfigurationConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemConfiguration', rtId: any, ckTypeId: any, rtWellKnownName?: string | null } | null> | null } | null } | null };

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