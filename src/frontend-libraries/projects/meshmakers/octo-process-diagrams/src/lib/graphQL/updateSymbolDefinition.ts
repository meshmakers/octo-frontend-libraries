import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateSymbolDefinitionMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiSymbolDefinitionInputUpdateDto | null | undefined> | Types.SystemUiSymbolDefinitionInputUpdateDto;
}>;


export type UpdateSymbolDefinitionMutationDto = { runtime: { systemUISymbolDefinitions: { update: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, boundsWidth: number, boundsHeight: number, category: string | null, tags: string | null, gridSize: number | null, canvasSizeWidth: number | null, canvasSizeHeight: number | null, rtChangedDateTime: any } | null> | null } | null } | null };

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