import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateSdkDemoCustomerMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.OctoSdkDemoCustomerInputUpdateDto>> | Types.InputMaybe<Types.OctoSdkDemoCustomerInputUpdateDto>;
}>;


export type UpdateSdkDemoCustomerMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', octoSdkDemoCustomers?: { __typename?: 'OctoSdkDemoCustomerMutations', update?: Array<{ __typename?: 'OctoSdkDemoCustomer', rtId: any, ckTypeId: any, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, customerStatus: Types.OctoSdkDemoCustomerStatusDto, contact: { __typename?: 'BasicContact', legalEntityType?: Types.BasicLegalEntityTypeDto | null, firstName?: string | null, lastName?: string | null, companyName?: string | null, address?: { __typename?: 'BasicAddress', street: string, zipcode: number, cityTown: string, nationalCode: string } | null } } | null> | null } | null } | null };

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