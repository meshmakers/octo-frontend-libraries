import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserResetPasswordMutationVariablesDto = Exact<{
  rtId: any;
  input: Types.SystemIdentityUserResetPasswordMethodInputDto;
}>;


export type IdentityUserResetPasswordMutationDto = { runtime: { systemIdentityUsers: { resetPassword: { invocationId: string } | null } | null } | null };

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