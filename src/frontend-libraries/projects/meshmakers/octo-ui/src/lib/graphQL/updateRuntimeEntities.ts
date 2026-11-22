import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateRuntimeEntitiesMutationVariablesDto = Exact<{
  entities: Array<Types.RtEntityUpdateDto | null | undefined> | Types.RtEntityUpdateDto;
}>;


export type UpdateRuntimeEntitiesMutationDto = { runtime: { runtimeEntities: { update: Array<{ rtId: any, ckTypeId: any } | null> | null } | null } | null };

export const UpdateRuntimeEntitiesDocumentDto = gql`
    mutation UpdateRuntimeEntities($entities: [RtEntityUpdate]!) {
  runtime {
    runtimeEntities {
      update(entities: $entities) {
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
  export class UpdateRuntimeEntitiesDtoGQL extends Apollo.Mutation<UpdateRuntimeEntitiesMutationDto, UpdateRuntimeEntitiesMutationVariablesDto> {
    document = UpdateRuntimeEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }