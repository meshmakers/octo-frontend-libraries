import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserSetRolesMutationVariablesDto = Exact<{
  rtId: any;
  input: Types.SystemIdentityUserSetRolesMethodInputDto;
}>;


export type IdentityUserSetRolesMutationDto = { runtime: { systemIdentityUsers: { setRoles: { invocationId: string } | null } | null } | null };

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