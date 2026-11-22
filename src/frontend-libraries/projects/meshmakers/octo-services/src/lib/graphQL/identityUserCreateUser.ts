import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserCreateUserMutationVariablesDto = Exact<{
  input: Types.SystemIdentityUserCreateUserMethodInputDto;
}>;


export type IdentityUserCreateUserMutationDto = { runtime: { systemIdentityUsers: { createUser: { invocationId: string, result: string | null } | null } | null } | null };

export const IdentityUserCreateUserDocumentDto = gql`
    mutation identityUserCreateUser($input: SystemIdentityUserCreateUserMethodInput!) {
  runtime {
    systemIdentityUsers {
      createUser(input: $input) {
        invocationId
        result
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserCreateUserDtoGQL extends Apollo.Mutation<IdentityUserCreateUserMutationDto, IdentityUserCreateUserMutationVariablesDto> {
    document = IdentityUserCreateUserDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }