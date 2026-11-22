import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateSymbolDefinitionMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiSymbolDefinitionInputDto | null | undefined> | Types.SystemUiSymbolDefinitionInputDto;
}>;


export type CreateSymbolDefinitionMutationDto = { runtime: { systemUISymbolDefinitions: { create: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, version: string, boundsWidth: number, boundsHeight: number, category: string | null, tags: string | null, gridSize: number | null, canvasSizeWidth: number | null, canvasSizeHeight: number | null, rtCreationDateTime: any } | null> | null } | null } | null };

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