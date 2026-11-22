import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateTreeNodesMutationVariablesDto = Exact<{
  entities: Array<Types.BasicTreeNodeInputUpdateDto | null | undefined> | Types.BasicTreeNodeInputUpdateDto;
}>;


export type UpdateTreeNodesMutationDto = { runtime: { basicTreeNodes: { update: Array<{ rtId: any } | null> | null } | null } | null };

export const UpdateTreeNodesDocumentDto = gql`
    mutation UpdateTreeNodes($entities: [BasicTreeNodeInputUpdate]!) {
  runtime {
    basicTreeNodes {
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
  export class UpdateTreeNodesDtoGQL extends Apollo.Mutation<UpdateTreeNodesMutationDto, UpdateTreeNodesMutationVariablesDto> {
    document = UpdateTreeNodesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }