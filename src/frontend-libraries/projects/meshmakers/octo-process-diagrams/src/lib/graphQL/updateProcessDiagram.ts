import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateProcessDiagramMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiProcessDiagramInputUpdateDto | null | undefined> | Types.SystemUiProcessDiagramInputUpdateDto;
}>;


export type UpdateProcessDiagramMutationDto = { runtime: { systemUIProcessDiagrams: { update: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, canvasWidth: number, canvasHeight: number, rtChangedDateTime: any } | null> | null } | null } | null };

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