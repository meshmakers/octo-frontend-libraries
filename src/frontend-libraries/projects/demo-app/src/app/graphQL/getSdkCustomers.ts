import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSdkCustomersQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  rtIds?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>> | Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetSdkCustomersQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', octoSdkDemoCustomer?: { __typename?: 'OctoSdkDemoCustomerConnection', totalCount?: number | null, items?: Array<{ __typename?: 'OctoSdkDemoCustomer', rtId: any, ckTypeId: any, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { __typename?: 'BasicContact', legalEntityType?: Types.BasicLegalEntityTypeDto | null, firstName?: string | null, lastName?: string | null, companyName?: string | null, address?: { __typename?: 'BasicAddress', street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

export const GetSdkCustomersDocumentDto = gql`
    query getSdkCustomers($after: String, $first: Int, $rtIds: [OctoObjectId], $searchFilter: SearchFilter, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    octoSdkDemoCustomer(
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
        rtCreationDateTime
        rtChangedDateTime
        customerStatus
        contact {
          legalEntityType
          firstName
          lastName
          companyName
          address {
            street
            zipcode
            cityTown
            nationalCode
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
  export class GetSdkCustomersDtoGQL extends Apollo.Query<GetSdkCustomersQueryDto, GetSdkCustomersQueryVariablesDto> {
    document = GetSdkCustomersDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }