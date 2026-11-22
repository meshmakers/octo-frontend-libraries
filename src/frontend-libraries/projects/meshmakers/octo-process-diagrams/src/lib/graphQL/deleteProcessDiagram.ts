import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type DeleteProcessDiagramMutationVariablesDto = Exact<{
  rtEntityIds: Array<Types.RtEntityIdDto | null | undefined> | Types.RtEntityIdDto;
  deleteStrategy?: Types.DeleteStrategiesDto;
}>;


export type DeleteProcessDiagramMutationDto = { runtime: { runtimeEntities: { delete: boolean | null } | null } | null };

export const DeleteProcessDiagramDocumentDto = gql`
    mutation deleteProcessDiagram($rtEntityIds: [RtEntityId]!, $deleteStrategy: DeleteStrategies! = ARCHIVE) {
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
  export class DeleteProcessDiagramDtoGQL extends Apollo.Mutation<DeleteProcessDiagramMutationDto, DeleteProcessDiagramMutationVariablesDto> {
    document = DeleteProcessDiagramDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }