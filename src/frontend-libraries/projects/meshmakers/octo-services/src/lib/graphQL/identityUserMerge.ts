import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type IdentityUserMergeMutationVariablesDto = Exact<{
  rtId: any;
  input: Types.SystemIdentityUserMergeMethodInputDto;
}>;


export type IdentityUserMergeMutationDto = { runtime: { systemIdentityUsers: { merge: { invocationId: string } | null } | null } | null };

export const IdentityUserMergeDocumentDto = gql`
    mutation identityUserMerge($rtId: OctoObjectId!, $input: SystemIdentityUserMergeMethodInput!) {
  runtime {
    systemIdentityUsers {
      merge(rtId: $rtId, input: $input) {
        invocationId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class IdentityUserMergeDtoGQL extends Apollo.Mutation<IdentityUserMergeMutationDto, IdentityUserMergeMutationVariablesDto> {
    document = IdentityUserMergeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }