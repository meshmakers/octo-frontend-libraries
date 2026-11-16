import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserRemoveRoleMutationVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  input: Types.SystemIdentityUserRemoveRoleMethodInputDto;
}>;


export type IdentityUserRemoveRoleMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', removeRole?: { __typename?: 'SystemIdentityUserRemoveRoleMethodResult', invocationId: string } | null } | null } | null };

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