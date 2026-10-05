import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormCreateEntitiesMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.RtEntityInputDto>> | Types.InputMaybe<Types.RtEntityInputDto>;
}>;


export type EntityFormCreateEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', create?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any } | null> | null } | null } | null };

export const EntityFormCreateEntitiesDocumentDto = gql`
    mutation entityFormCreateEntities($entities: [RtEntityInput]!) {
  runtime {
    runtimeEntities {
      create(entities: $entities) {
        rtId
        ckTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormCreateEntitiesDtoGQL extends Apollo.Mutation<EntityFormCreateEntitiesMutationDto, EntityFormCreateEntitiesMutationVariablesDto> {
    document = EntityFormCreateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }