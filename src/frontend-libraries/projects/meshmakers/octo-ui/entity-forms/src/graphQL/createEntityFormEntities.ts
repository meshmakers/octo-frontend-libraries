import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormCreateEntitiesMutationVariablesDto = Exact<{
  entities: Array<Types.RtEntityInputDto | null | undefined> | Types.RtEntityInputDto;
}>;


export type EntityFormCreateEntitiesMutationDto = { runtime: { runtimeEntities: { create: Array<{ rtId: any, ckTypeId: any } | null> | null } | null } | null };

export const EntityFormCreateEntitiesDocumentDto = gql`
    mutation entityFormCreateEntities($entities: [RtEntityInput]!) {
  runtime {
    runtimeEntities {
      create(entities: $entities) {
        rtId
        ckTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormCreateEntitiesDtoGQL extends Apollo.Mutation<EntityFormCreateEntitiesMutationDto, EntityFormCreateEntitiesMutationVariablesDto> {
    document = EntityFormCreateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }