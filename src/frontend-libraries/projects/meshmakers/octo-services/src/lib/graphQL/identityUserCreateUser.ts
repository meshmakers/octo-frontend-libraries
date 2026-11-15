import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserCreateUserMutationVariablesDto = Types.Exact<{
  input: Types.SystemIdentityUserCreateUserMethodInputDto;
}>;


export type IdentityUserCreateUserMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', createUser?: { __typename?: 'SystemIdentityUserCreateUserMethodResult', invocationId: string, result?: string | null } | null } | null } | null };

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