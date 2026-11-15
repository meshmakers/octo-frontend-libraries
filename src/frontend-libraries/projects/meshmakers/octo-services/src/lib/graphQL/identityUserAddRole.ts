import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserAddRoleMutationVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  input: Types.SystemIdentityUserAddRoleMethodInputDto;
}>;


export type IdentityUserAddRoleMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', addRole?: { __typename?: 'SystemIdentityUserAddRoleMethodResult', invocationId: string } | null } | null } | null };

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