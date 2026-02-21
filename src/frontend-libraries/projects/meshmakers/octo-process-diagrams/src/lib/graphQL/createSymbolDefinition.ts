import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateSymbolDefinitionMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiSymbolDefinitionInputDto>> | Types.InputMaybe<Types.SystemUiSymbolDefinitionInputDto>;
}>;


export type CreateSymbolDefinitionMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUISymbolDefinitions?: { __typename?: 'SystemUISymbolDefinitionMutations', create?: Array<{ __typename?: 'SystemUISymbolDefinition', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, boundsWidth: number, boundsHeight: number, category?: string | null, tags?: string | null, gridSize?: number | null, canvasSizeWidth?: number | null, canvasSizeHeight?: number | null, rtCreationDateTime?: any | null } | null> | null } | null } | null };

export const CreateSymbolDefinitionDocumentDto = gql`
    mutation createSymbolDefinition($entities: [SystemUISymbolDefinitionInput]!) {
  runtime {
    systemUISymbolDefinitions {
      create(entities: $entities) {
        rtId
        ckTypeId
        name
        description
        version
        boundsWidth
        boundsHeight
        category
        tags
        gridSize
        canvasSizeWidth
        canvasSizeHeight
        rtCreationDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateSymbolDefinitionDtoGQL extends Apollo.Mutation<CreateSymbolDefinitionMutationDto, CreateSymbolDefinitionMutationVariablesDto> {
    document = CreateSymbolDefinitionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }