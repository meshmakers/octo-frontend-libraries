import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormDeleteEntitiesMutationVariablesDto = Types.Exact<{
  rtEntityIds: Array<Types.InputMaybe<Types.RtEntityIdDto>> | Types.InputMaybe<Types.RtEntityIdDto>;
  deleteStrategy?: Types.DeleteStrategiesDto;
}>;


export type EntityFormDeleteEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', delete?: boolean | null } | null } | null };

export const EntityFormDeleteEntitiesDocumentDto = gql`
    mutation entityFormDeleteEntities($rtEntityIds: [RtEntityId]!, $deleteStrategy: DeleteStrategies! = ARCHIVE) {
  runtime {
    runtimeEntities {
      delete(entities: $rtEntityIds, options: $deleteStrategy)
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormDeleteEntitiesDtoGQL extends Apollo.Mutation<EntityFormDeleteEntitiesMutationDto, EntityFormDeleteEntitiesMutationVariablesDto> {
    document = EntityFormDeleteEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }