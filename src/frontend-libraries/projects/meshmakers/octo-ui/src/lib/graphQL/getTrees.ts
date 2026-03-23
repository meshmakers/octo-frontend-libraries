import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetTreesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
}>;


export type GetTreesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null } | null> | null } | null } | null };

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