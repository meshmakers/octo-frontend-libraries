import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetTreeAssociationTargetsQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  roleId: string;
  targetCkTypeId: string;
  direction: Types.GraphDirectionDto;
  first?: number | null | undefined;
}>;


export type GetTreeAssociationTargetsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, associations: { targets: { totalCount: number | null, items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, rtWellKnownName: string | null, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetTreeAssociationTargetsDocumentDto = gql`
    query getTreeAssociationTargets($rtId: OctoObjectId!, $ckTypeId: String!, $roleId: String!, $targetCkTypeId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId, first: 1) {
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
              rtDisplayName
              rtDisplayDescription
              rtWellKnownName
              ckTypeId
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
  export class GetTreeAssociationTargetsDtoGQL extends Apollo.Query<GetTreeAssociationTargetsQueryDto, GetTreeAssociationTargetsQueryVariablesDto> {
    document = GetTreeAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }