import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetAssociationTargetsQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  targetCkTypeId: string;
  roleId: string;
  direction: Types.GraphDirectionDto;
  first?: number | null | undefined;
  attributeNames: Array<string> | string;
}>;


export type GetAssociationTargetsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, associations: { targets: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetAssociationTargetsDocumentDto = gql`
    query getAssociationTargets($rtId: OctoObjectId!, $ckTypeId: String!, $targetCkTypeId: String!, $roleId: String!, $direction: GraphDirection!, $first: Int, $attributeNames: [String!]!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId, first: 1) {
      items {
        rtId
        associations {
          targets(
            ckId: $targetCkTypeId
            roleId: $roleId
            direction: $direction
            first: $first
          ) {
            totalCount
            items {
              rtId
              ckTypeId
              rtWellKnownName
              rtDisplayName
              attributes(attributeNames: $attributeNames, resolveEnumValuesToNames: true) {
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
  export class GetAssociationTargetsDtoGQL extends Apollo.Query<GetAssociationTargetsQueryDto, GetAssociationTargetsQueryVariablesDto> {
    document = GetAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }