import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetAssociationTargetsQueryVariablesDto = Exact<{
  ckTypeId: string;
  rtId: any;
  roleId: string;
  targetCkTypeId: string;
  direction: Types.GraphDirectionDto;
  first?: number | null | undefined;
}>;


export type EntityFormGetAssociationTargetsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, associations: { targets: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const EntityFormGetAssociationTargetsDocumentDto = gql`
    query entityFormGetAssociationTargets($ckTypeId: String!, $rtId: OctoObjectId!, $roleId: String!, $targetCkTypeId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId, first: 1) {
      items {
        rtId
        associations {
          targets(
            roleId: $roleId
            ckId: $targetCkTypeId
            direction: $direction
            first: $first
          ) {
            totalCount
            items {
              rtId
              ckTypeId
              rtWellKnownName
              rtDisplayName
              attributes(attributeNames: ["name"]) {
                items {
                  attributeName
                  value
                }
              }
            }
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
  export class EntityFormGetAssociationTargetsDtoGQL extends Apollo.Query<EntityFormGetAssociationTargetsQueryDto, EntityFormGetAssociationTargetsQueryVariablesDto> {
    document = EntityFormGetAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }