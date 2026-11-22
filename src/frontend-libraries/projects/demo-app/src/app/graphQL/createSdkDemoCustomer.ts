import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateSdkDemoCustomerMutationVariablesDto = Exact<{
  entities: Array<Types.OctoSdkDemoCustomerInputDto | null | undefined> | Types.OctoSdkDemoCustomerInputDto;
}>;


export type CreateSdkDemoCustomerMutationDto = { runtime: { octoSdkDemoCustomers: { create: Array<{ rtId: any, ckTypeId: any, rtCreationDateTime: any, rtChangedDateTime: any, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { legalEntityType: Types.BasicLegalEntityTypeDto | null, firstName: string | null, lastName: string | null, companyName: string | null, address: { street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

export const CreateSdkDemoCustomerDocumentDto = gql`
    mutation createSdkDemoCustomer($entities: [OctoSdkDemoCustomerInput]!) {
  runtime {
    octoSdkDemoCustomers {
      create(entities: $entities) {
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
  export class CreateSdkDemoCustomerDtoGQL extends Apollo.Mutation<CreateSdkDemoCustomerMutationDto, CreateSdkDemoCustomerMutationVariablesDto> {
    document = CreateSdkDemoCustomerDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }