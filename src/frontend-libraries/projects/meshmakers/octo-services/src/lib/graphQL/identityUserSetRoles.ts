import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserSetRolesMutationVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  input: Types.SystemIdentityUserSetRolesMethodInputDto;
}>;


export type IdentityUserSetRolesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', setRoles?: { __typename?: 'SystemIdentityUserSetRolesMethodResult', invocationId: string } | null } | null } | null };

export const IdentityUserSetRolesDocumentDto = gql`
    mutation identityUserSetRoles($rtId: OctoObjectId!, $input: SystemIdentityUserSetRolesMethodInput!) {
  runtime {
    systemIdentityUsers {
      setRoles(rtId: $rtId, input: $input) {
        invocationId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserSetRolesDtoGQL extends Apollo.Mutation<IdentityUserSetRolesMutationDto, IdentityUserSetRolesMutationVariablesDto> {
    document = IdentityUserSetRolesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }