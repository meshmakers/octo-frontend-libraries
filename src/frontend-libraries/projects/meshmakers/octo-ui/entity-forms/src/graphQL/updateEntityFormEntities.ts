import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormUpdateEntitiesMutationVariablesDto = Exact<{
  entities: Array<Types.RtEntityUpdateDto | null | undefined> | Types.RtEntityUpdateDto;
}>;


export type EntityFormUpdateEntitiesMutationDto = { runtime: { runtimeEntities: { update: Array<{ rtId: any } | null> | null } | null } | null };

export const EntityFormUpdateEntitiesDocumentDto = gql`
    mutation entityFormUpdateEntities($entities: [RtEntityUpdate]!) {
  runtime {
    runtimeEntities {
      update(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormUpdateEntitiesDtoGQL extends Apollo.Mutation<EntityFormUpdateEntitiesMutationDto, EntityFormUpdateEntitiesMutationVariablesDto> {
    document = EntityFormUpdateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }