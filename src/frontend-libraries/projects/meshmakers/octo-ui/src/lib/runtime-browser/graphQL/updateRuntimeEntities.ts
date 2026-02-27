import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateRuntimeEntitiesMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.RtEntityUpdateDto>> | Types.InputMaybe<Types.RtEntityUpdateDto>;
}>;


export type UpdateRuntimeEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', update?: Array<{ __typename?: 'RtEntity', rtId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null };

export const UpdateRuntimeEntitiesDocumentDto = gql`
    mutation UpdateRuntimeEntities($entities: [RtEntityUpdate]!) {
  runtime {
    runtimeEntities {
      update(entities: $entities) {
        rtId
        attributes {
          items {
            attributeName
            value
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateRuntimeEntitiesDtoGQL extends Apollo.Mutation<UpdateRuntimeEntitiesMutationDto, UpdateRuntimeEntitiesMutationVariablesDto> {
    override document = UpdateRuntimeEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }