import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateSdkDemoCustomerMutationVariablesDto = Exact<{
  entities: Array<Types.OctoSdkDemoCustomerInputUpdateDto | null | undefined> | Types.OctoSdkDemoCustomerInputUpdateDto;
}>;


export type UpdateSdkDemoCustomerMutationDto = { runtime: { octoSdkDemoCustomers: { update: Array<{ rtId: any, ckTypeId: any, rtCreationDateTime: any, rtChangedDateTime: any, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { legalEntityType: Types.BasicLegalEntityTypeDto | null, firstName: string | null, lastName: string | null, companyName: string | null, address: { street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

export const UpdateSdkDemoCustomerDocumentDto = gql`
    mutation updateSdkDemoCustomer($entities: [OctoSdkDemoCustomerInputUpdate]!) {
  runtime {
    octoSdkDemoCustomers {
      update(entities: $entities) {
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
  export class UpdateSdkDemoCustomerDtoGQL extends Apollo.Mutation<UpdateSdkDemoCustomerMutationDto, UpdateSdkDemoCustomerMutationVariablesDto> {
    document = UpdateSdkDemoCustomerDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }