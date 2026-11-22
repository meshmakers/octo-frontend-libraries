import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserRemoveRoleMutationVariablesDto = Exact<{
  rtId: any;
  input: Types.SystemIdentityUserRemoveRoleMethodInputDto;
}>;


export type IdentityUserRemoveRoleMutationDto = { runtime: { systemIdentityUsers: { removeRole: { invocationId: string } | null } | null } | null };

export const IdentityUserRemoveRoleDocumentDto = gql`
    mutation identityUserRemoveRole($rtId: OctoObjectId!, $input: SystemIdentityUserRemoveRoleMethodInput!) {
  runtime {
    systemIdentityUsers {
      removeRole(rtId: $rtId, input: $input) {
        invocationId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserRemoveRoleDtoGQL extends Apollo.Mutation<IdentityUserRemoveRoleMutationDto, IdentityUserRemoveRoleMutationVariablesDto> {
    document = IdentityUserRemoveRoleDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }