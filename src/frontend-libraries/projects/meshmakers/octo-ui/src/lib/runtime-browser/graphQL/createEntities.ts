import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateEntitiesMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.RtEntityInputDto>> | Types.InputMaybe<Types.RtEntityInputDto>;
}>;


export type CreateEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', create?: Array<{ __typename?: 'RtEntity', rtId: any } | null> | null } | null } | null };

export const CreateEntitiesDocumentDto = gql`
    mutation CreateEntities($entities: [RtEntityInput]!) {
  runtime {
    runtimeEntities {
      create(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateEntitiesDtoGQL extends Apollo.Mutation<CreateEntitiesMutationDto, CreateEntitiesMutationVariablesDto> {
    document = CreateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }