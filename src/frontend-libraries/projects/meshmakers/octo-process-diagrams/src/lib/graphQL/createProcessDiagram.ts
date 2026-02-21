import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateProcessDiagramMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiProcessDiagramInputDto>> | Types.InputMaybe<Types.SystemUiProcessDiagramInputDto>;
}>;


export type CreateProcessDiagramMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIProcessDiagrams?: { __typename?: 'SystemUIProcessDiagramMutations', create?: Array<{ __typename?: 'SystemUIProcessDiagram', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, canvasWidth: number, canvasHeight: number, rtCreationDateTime?: any | null } | null> | null } | null } | null };

export const CreateProcessDiagramDocumentDto = gql`
    mutation createProcessDiagram($entities: [SystemUIProcessDiagramInput]!) {
  runtime {
    systemUIProcessDiagrams {
      create(entities: $entities) {
        rtId
        ckTypeId
        name
        description
        version
        canvasWidth
        canvasHeight
        rtCreationDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateProcessDiagramDtoGQL extends Apollo.Mutation<CreateProcessDiagramMutationDto, CreateProcessDiagramMutationVariablesDto> {
    document = CreateProcessDiagramDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }