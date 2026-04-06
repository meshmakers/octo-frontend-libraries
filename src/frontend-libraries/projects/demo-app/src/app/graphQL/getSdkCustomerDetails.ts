import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetSdkCustomerDetailsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetSdkCustomerDetailsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', octoSdkDemoCustomer?: { __typename?: 'OctoSdkDemoCustomerConnection', items?: Array<{ __typename?: 'OctoSdkDemoCustomer', rtId: any, ckTypeId: any, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { __typename?: 'BasicContact', legalEntityType?: Types.BasicLegalEntityTypeDto | null, firstName?: string | null, lastName?: string | null, companyName?: string | null, address?: { __typename?: 'BasicAddress', street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

export const GetSdkCustomerDetailsDocumentDto = gql`
    query getSdkCustomerDetails($rtId: OctoObjectId!) {
  runtime {
    octoSdkDemoCustomer(rtId: $rtId) {
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
  export class GetSdkCustomerDetailsDtoGQL extends Apollo.Query<GetSdkCustomerDetailsQueryDto, GetSdkCustomerDetailsQueryVariablesDto> {
    document = GetSdkCustomerDetailsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }