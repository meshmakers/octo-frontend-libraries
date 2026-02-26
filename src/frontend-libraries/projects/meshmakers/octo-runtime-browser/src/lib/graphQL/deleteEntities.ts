import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type DeleteEntitiesMutationVariablesDto = Types.Exact<{
  rtEntityIds: Array<Types.InputMaybe<Types.RtEntityIdDto>> | Types.InputMaybe<Types.RtEntityIdDto>;
}>;


export type DeleteEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', delete?: boolean | null } | null } | null };

export const DeleteEntitiesDocumentDto = gql`
    mutation deleteEntities($rtEntityIds: [RtEntityId]!) {
  runtime {
    runtimeEntities {
      delete(entities: $rtEntityIds)
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class DeleteEntitiesDtoGQL extends Apollo.Mutation<DeleteEntitiesMutationDto, DeleteEntitiesMutationVariablesDto> {
    document = DeleteEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }