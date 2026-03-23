import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetTreeNodesQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  directRoleId: Types.Scalars['String']['input'];
  directTargetCkTypeId: Types.Scalars['String']['input'];
  indirectRoleId: Types.Scalars['String']['input'];
  indirectTargetCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetTreeNodesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetTreeNodesDocumentDto = gql`
    query getTreeNodes($rtId: OctoObjectId!, $ckTypeId: String!, $directRoleId: String!, $directTargetCkTypeId: String!, $indirectRoleId: String!, $indirectTargetCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId) {
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
          targets(roleId: $directRoleId, ckId: $directTargetCkTypeId, direction: INBOUND) {
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