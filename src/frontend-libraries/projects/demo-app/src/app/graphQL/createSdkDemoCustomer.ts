import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateSdkDemoCustomerMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.OctoSdkDemoCustomerInputDto>> | Types.InputMaybe<Types.OctoSdkDemoCustomerInputDto>;
}>;


export type CreateSdkDemoCustomerMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', octoSdkDemoCustomers?: { __typename?: 'OctoSdkDemoCustomerMutations', create?: Array<{ __typename?: 'OctoSdkDemoCustomer', rtId: any, ckTypeId: any, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { __typename?: 'BasicContact', legalEntityType?: Types.BasicLegalEntityTypeDto | null, firstName?: string | null, lastName?: string | null, companyName?: string | null, address?: { __typename?: 'BasicAddress', street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

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