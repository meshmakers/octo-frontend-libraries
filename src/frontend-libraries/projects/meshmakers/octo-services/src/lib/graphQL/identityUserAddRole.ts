import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserAddRoleMutationVariablesDto = Exact<{
  rtId: any;
  input: Types.SystemIdentityUserAddRoleMethodInputDto;
}>;


export type IdentityUserAddRoleMutationDto = { runtime: { systemIdentityUsers: { addRole: { invocationId: string } | null } | null } | null };

export const IdentityUserAddRoleDocumentDto = gql`
    mutation identityUserAddRole($rtId: OctoObjectId!, $input: SystemIdentityUserAddRoleMethodInput!) {
  runtime {
    systemIdentityUsers {
      addRole(rtId: $rtId, input: $input) {
        invocationId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserAddRoleDtoGQL extends Apollo.Mutation<IdentityUserAddRoleMutationDto, IdentityUserAddRoleMutationVariablesDto> {
    document = IdentityUserAddRoleDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }