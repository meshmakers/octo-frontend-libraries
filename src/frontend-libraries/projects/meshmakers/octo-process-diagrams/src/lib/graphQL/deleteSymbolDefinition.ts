import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type DeleteSymbolDefinitionMutationVariablesDto = Exact<{
  rtEntityIds: Array<Types.RtEntityIdDto | null | undefined> | Types.RtEntityIdDto;
  deleteStrategy?: Types.DeleteStrategiesDto;
}>;


export type DeleteSymbolDefinitionMutationDto = { runtime: { runtimeEntities: { delete: boolean | null } | null } | null };

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