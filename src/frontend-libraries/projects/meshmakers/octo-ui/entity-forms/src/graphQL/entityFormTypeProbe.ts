import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormTypeProbeQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type EntityFormTypeProbeQueryDto = { constructionKit: { types: { items: Array<{ rtCkTypeId: any } | null> | null } | null } | null };

export const EntityFormTypeProbeDocumentDto = gql`
    query entityFormTypeProbe {
  constructionKit {
    types(rtCkId: "System.UI/EntityForm", first: 1) {
      items {
        rtCkTypeId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormTypeProbeDtoGQL extends Apollo.Query<EntityFormTypeProbeQueryDto, EntityFormTypeProbeQueryVariablesDto> {
    document = EntityFormTypeProbeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }