import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetEntityFormsQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type EntityFormGetEntityFormsQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, items: Array<{ rtId: any, rtWellKnownName: string | null, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetEntityFormsDocumentDto = gql`
    query entityFormGetEntityForms {
  runtime {
    runtimeEntities(ckId: "System.UI/EntityForm", first: 500) {
      totalCount
      items {
        rtId
        rtWellKnownName
        ckTypeId
        attributes {
          items {
            attributeName
            value
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetEntityFormsDtoGQL extends Apollo.Query<EntityFormGetEntityFormsQueryDto, EntityFormGetEntityFormsQueryVariablesDto> {
    document = EntityFormGetEntityFormsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }