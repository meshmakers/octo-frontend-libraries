import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetSdkCustomerDetailsQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type GetSdkCustomerDetailsQueryDto = { runtime: { octoSdkDemoCustomer: { items: Array<{ rtId: any, ckTypeId: any, rtCreationDateTime: any, rtChangedDateTime: any, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { legalEntityType: Types.BasicLegalEntityTypeDto | null, firstName: string | null, lastName: string | null, companyName: string | null, address: { street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

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