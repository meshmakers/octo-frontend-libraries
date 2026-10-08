import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormUpdateEntitiesMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.RtEntityUpdateDto>> | Types.InputMaybe<Types.RtEntityUpdateDto>;
}>;


export type EntityFormUpdateEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', update?: Array<{ __typename?: 'RtEntity', rtId: any } | null> | null } | null } | null };

export const EntityFormUpdateEntitiesDocumentDto = gql`
    mutation entityFormUpdateEntities($entities: [RtEntityUpdate]!) {
  runtime {
    runtimeEntities {
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
  export class EntityFormUpdateEntitiesDtoGQL extends Apollo.Mutation<EntityFormUpdateEntitiesMutationDto, EntityFormUpdateEntitiesMutationVariablesDto> {
    document = EntityFormUpdateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }