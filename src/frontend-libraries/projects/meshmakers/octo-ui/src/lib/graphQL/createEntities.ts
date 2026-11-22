import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateEntitiesMutationVariablesDto = Exact<{
  entities: Array<Types.RtEntityInputDto | null | undefined> | Types.RtEntityInputDto;
}>;


export type CreateEntitiesMutationDto = { runtime: { runtimeEntities: { create: Array<{ rtId: any } | null> | null } | null } | null };

export const CreateEntitiesDocumentDto = gql`
    mutation CreateEntities($entities: [RtEntityInput]!) {
  runtime {
    runtimeEntities {
      create(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateEntitiesDtoGQL extends Apollo.Mutation<CreateEntitiesMutationDto, CreateEntitiesMutationVariablesDto> {
    document = CreateEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }