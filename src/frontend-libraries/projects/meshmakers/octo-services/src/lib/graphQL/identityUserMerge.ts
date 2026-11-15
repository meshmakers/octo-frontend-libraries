import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type IdentityUserMergeMutationVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  input: Types.SystemIdentityUserMergeMethodInputDto;
}>;


export type IdentityUserMergeMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemIdentityUsers?: { __typename?: 'SystemIdentityUserMutations', merge?: { __typename?: 'SystemIdentityUserMergeMethodResult', invocationId: string } | null } | null } | null };

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