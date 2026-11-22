import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetRuntimeEntityAssociationsByIdQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  direction: Types.GraphDirectionDto;
  after?: string | null | undefined;
  first?: number | null | undefined;
  roleId?: string | null | undefined;
  relatedRtCkId?: any;
  relatedRtId?: any;
}>;


export type GetRuntimeEntityAssociationsByIdQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, associations: { definitions: { totalCount: number | null, items: Array<{ targetRtId: any, targetCkTypeId: any, originRtId: any, originCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetRuntimeEntityAssociationsByIdDocumentDto = gql`
    query getRuntimeEntityAssociationsById($rtId: OctoObjectId!, $ckTypeId: String!, $direction: GraphDirection!, $after: String, $first: Int, $roleId: String, $relatedRtCkId: RtCkTypeId, $relatedRtId: OctoObjectId) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId) {
      items {
        rtId
        rtDisplayName
        rtDisplayDescription
        ckTypeId
        associations {
          definitions(
            direction: $direction
            roleId: $roleId
            relatedRtCkId: $relatedRtCkId
            relatedRtId: $relatedRtId
            after: $after
            first: $first
          ) {
            totalCount
            items {
              targetRtId
              targetCkTypeId
              originRtId
              originCkTypeId
              ckAssociationRoleId
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
  export class GetRuntimeEntityAssociationsByIdDtoGQL extends Apollo.Query<GetRuntimeEntityAssociationsByIdQueryDto, GetRuntimeEntityAssociationsByIdQueryVariablesDto> {
    document = GetRuntimeEntityAssociationsByIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }