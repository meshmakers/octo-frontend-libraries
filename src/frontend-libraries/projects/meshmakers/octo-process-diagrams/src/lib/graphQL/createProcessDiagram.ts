import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateProcessDiagramMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiProcessDiagramInputDto | null | undefined> | Types.SystemUiProcessDiagramInputDto;
}>;


export type CreateProcessDiagramMutationDto = { runtime: { systemUIProcessDiagrams: { create: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, canvasWidth: number, canvasHeight: number, rtCreationDateTime: any } | null> | null } | null } | null };

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