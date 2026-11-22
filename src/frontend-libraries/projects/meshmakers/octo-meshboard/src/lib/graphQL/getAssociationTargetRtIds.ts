import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetAssociationTargetRtIdsQueryVariablesDto = Exact<{
  rtIds: Array<any> | any;
  ckTypeId: string;
  targetCkTypeId: string;
  roleId: string;
  direction: Types.GraphDirectionDto;
  first: number;
  targetsFirst: number;
}>;


export type GetAssociationTargetRtIdsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, associations: { targets: { totalCount: number | null, items: Array<{ rtId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetAssociationTargetRtIdsDocumentDto = gql`
    query getAssociationTargetRtIds($rtIds: [OctoObjectId]!, $ckTypeId: String!, $targetCkTypeId: String!, $roleId: String!, $direction: GraphDirection!, $first: Int!, $targetsFirst: Int!) {
  runtime {
    runtimeEntities(rtIds: $rtIds, ckId: $ckTypeId, first: $first) {
      items {
        rtId
        associations {
          targets(
            ckId: $targetCkTypeId
            roleId: $roleId
            direction: $direction
            first: $targetsFirst
          ) {
            totalCount
            items {
              rtId
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
  export class GetAssociationTargetRtIdsDtoGQL extends Apollo.Query<GetAssociationTargetRtIdsQueryDto, GetAssociationTargetRtIdsQueryVariablesDto> {
    document = GetAssociationTargetRtIdsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }