import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSdkMeteringPointQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  rtIds?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>> | Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetSdkMeteringPointQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', octoSdkDemoMeteringPoint?: { __typename?: 'OctoSdkDemoMeteringPointConnection', totalCount?: number | null, items?: Array<{ __typename?: 'OctoSdkDemoMeteringPoint', rtId: any, ckTypeId: any, name: string, meteringPointNumber: string, networkOperator?: Types.OctoSdkDemoNetworkOperatorDto | null, operatingStatus: Types.OctoSdkDemoOperatingStatusDto } | null> | null } | null } | null };

export const GetSdkMeteringPointDocumentDto = gql`
    query getSdkMeteringPoint($after: String, $first: Int, $rtIds: [OctoObjectId], $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    octoSdkDemoMeteringPoint(
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
        name
        meteringPointNumber
        networkOperator
        operatingStatus
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetSdkMeteringPointDtoGQL extends Apollo.Query<GetSdkMeteringPointQueryDto, GetSdkMeteringPointQueryVariablesDto> {
    document = GetSdkMeteringPointDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }