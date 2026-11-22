import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormDeleteEntitiesMutationVariablesDto = Exact<{
  rtEntityIds: Array<Types.RtEntityIdDto | null | undefined> | Types.RtEntityIdDto;
  deleteStrategy?: Types.DeleteStrategiesDto;
}>;


export type EntityFormDeleteEntitiesMutationDto = { runtime: { runtimeEntities: { delete: boolean | null } | null } | null };

export const EntityFormDeleteEntitiesDocumentDto = gql`
    mutation entityFormDeleteEntities($rtEntityIds: [RtEntityId]!, $deleteStrategy: DeleteStrategies! = ARCHIVE) {
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
  export class EntityFormDeleteEntitiesDtoGQL extends Apollo.Mutation<EntityFormDeleteEntitiesMutationDto, EntityFormDeleteEntitiesMutationVariablesDto> {
    document = EntityFormDeleteEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }