import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateProcessDiagramMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiProcessDiagramInputUpdateDto>> | Types.InputMaybe<Types.SystemUiProcessDiagramInputUpdateDto>;
}>;


export type UpdateProcessDiagramMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIProcessDiagrams?: { __typename?: 'SystemUIProcessDiagramMutations', update?: Array<{ __typename?: 'SystemUIProcessDiagram', rtId: any, ckTypeId: any, name: string, description?: string | null, version: string, canvasWidth: number, canvasHeight: number, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const UpdateProcessDiagramDocumentDto = gql`
    mutation updateProcessDiagram($entities: [SystemUIProcessDiagramInputUpdate]!) {
  runtime {
    systemUIProcessDiagrams {
      update(entities: $entities) {
        rtId
        ckTypeId
        name
        description
        version
        canvasWidth
        canvasHeight
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateProcessDiagramDtoGQL extends Apollo.Mutation<UpdateProcessDiagramMutationDto, UpdateProcessDiagramMutationVariablesDto> {
    document = UpdateProcessDiagramDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }