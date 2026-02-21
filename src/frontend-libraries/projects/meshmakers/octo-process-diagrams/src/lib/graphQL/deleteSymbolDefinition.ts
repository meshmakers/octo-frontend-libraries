import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type DeleteSymbolDefinitionMutationVariablesDto = Types.Exact<{
  rtEntityIds: Array<Types.InputMaybe<Types.RtEntityIdDto>> | Types.InputMaybe<Types.RtEntityIdDto>;
  deleteStrategy?: Types.DeleteStrategiesDto;
}>;


export type DeleteSymbolDefinitionMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', delete?: boolean | null } | null } | null };

export const DeleteSymbolDefinitionDocumentDto = gql`
    mutation deleteSymbolDefinition($rtEntityIds: [RtEntityId]!, $deleteStrategy: DeleteStrategies! = ARCHIVE) {
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
  export class DeleteSymbolDefinitionDtoGQL extends Apollo.Mutation<DeleteSymbolDefinitionMutationDto, DeleteSymbolDefinitionMutationVariablesDto> {
    document = DeleteSymbolDefinitionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }