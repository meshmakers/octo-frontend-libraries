import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetTreeNodesQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  directRoleId: string;
  directTargetCkTypeId: string;
  indirectRoleId: string;
  indirectTargetCkTypeId: string;
}>;


export type GetTreeNodesQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, associations: { targets: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, associations: { targets: { totalCount: number | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetTreeNodesDocumentDto = gql`
    query getTreeNodes($rtId: OctoObjectId!, $ckTypeId: String!, $directRoleId: String!, $directTargetCkTypeId: String!, $indirectRoleId: String!, $indirectTargetCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId) {
      items {
        rtId
        rtDisplayName
        rtDisplayDescription
        ckTypeId
        associations {
          targets(roleId: $directRoleId, ckId: $directTargetCkTypeId, direction: INBOUND) {
            items {
              rtId
              rtDisplayName
              rtDisplayDescription
              ckTypeId
              associations {
                targets(
                  roleId: $indirectRoleId
                  ckId: $indirectTargetCkTypeId
                  direction: INBOUND
                ) {
                  totalCount
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
  export class GetTreeNodesDtoGQL extends Apollo.Query<GetTreeNodesQueryDto, GetTreeNodesQueryVariablesDto> {
    document = GetTreeNodesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }