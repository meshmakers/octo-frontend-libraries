import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserResetPasswordMutationVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  input: Types.SystemIdentityUserResetPasswordMethodInputDto;
}>;


export type IdentityUserResetPasswordMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', resetPassword?: { __typename?: 'SystemIdentityUserResetPasswordMethodResult', invocationId: string } | null } | null } | null };

export const IdentityUserResetPasswordDocumentDto = gql`
    mutation identityUserResetPassword($rtId: OctoObjectId!, $input: SystemIdentityUserResetPasswordMethodInput!) {
  runtime {
    systemIdentityUsers {
      resetPassword(rtId: $rtId, input: $input) {
        invocationId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserResetPasswordDtoGQL extends Apollo.Mutation<IdentityUserResetPasswordMutationDto, IdentityUserResetPasswordMutationVariablesDto> {
    document = IdentityUserResetPasswordDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }