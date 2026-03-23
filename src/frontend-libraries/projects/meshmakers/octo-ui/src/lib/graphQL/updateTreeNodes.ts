import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateTreeNodesMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.BasicTreeNodeInputUpdateDto>> | Types.InputMaybe<Types.BasicTreeNodeInputUpdateDto>;
}>;


export type UpdateTreeNodesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', basicTreeNodes?: { __typename?: 'BasicTreeNodeMutations', update?: Array<{ __typename?: 'BasicTreeNode', rtId: any } | null> | null } | null } | null };

export const UpdateTreeNodesDocumentDto = gql`
    mutation UpdateTreeNodes($entities: [BasicTreeNodeInputUpdate]!) {
  runtime {
    basicTreeNodes {
      update(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateTreeNodesDtoGQL extends Apollo.Mutation<UpdateTreeNodesMutationDto, UpdateTreeNodesMutationVariablesDto> {
    document = UpdateTreeNodesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }