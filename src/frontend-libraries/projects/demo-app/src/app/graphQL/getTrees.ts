import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetTreesQueryVariablesDto = Exact<{
  ckTypeId: string;
}>;


export type GetTreesQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { targets: { totalCount: number | null } | null } | null } | null> | null } | null } | null };

export const GetTreesDocumentDto = gql`
    query getTrees($ckTypeId: String!) {
  runtime {
    runtimeEntities(ckId: $ckTypeId) {
      items {
        rtId
        ckTypeId
        attributes(attributeNames: ["name", "description"]) {
          items {
            attributeName
            value
          }
        }
        associations {
          targets(
            roleId: "System/ParentChild"
            ckId: "Basic/TreeNode"
            direction: INBOUND
          ) {
            totalCount
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
  export class GetTreesDtoGQL extends Apollo.Query<GetTreesQueryDto, GetTreesQueryVariablesDto> {
    document = GetTreesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }