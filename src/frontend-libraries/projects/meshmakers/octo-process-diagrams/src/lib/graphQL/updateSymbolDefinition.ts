import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateSymbolDefinitionMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiSymbolDefinitionInputUpdateDto>> | Types.InputMaybe<Types.SystemUiSymbolDefinitionInputUpdateDto>;
}>;


export type UpdateSymbolDefinitionMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUISymbolDefinitions?: { __typename?: 'SystemUISymbolDefinitionMutations', update?: Array<{ __typename?: 'SystemUISymbolDefinition', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, boundsWidth: number, boundsHeight: number, category?: string | null, tags?: string | null, gridSize?: number | null, canvasSizeWidth?: number | null, canvasSizeHeight?: number | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const UpdateSymbolDefinitionDocumentDto = gql`
    mutation updateSymbolDefinition($entities: [SystemUISymbolDefinitionInputUpdate]!) {
  runtime {
    systemUISymbolDefinitions {
      update(entities: $entities) {
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
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateSymbolDefinitionDtoGQL extends Apollo.Mutation<UpdateSymbolDefinitionMutationDto, UpdateSymbolDefinitionMutationVariablesDto> {
    document = UpdateSymbolDefinitionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }