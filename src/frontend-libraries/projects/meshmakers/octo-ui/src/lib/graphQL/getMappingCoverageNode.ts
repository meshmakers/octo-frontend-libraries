import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetMappingCoverageNodeQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  childRoleId: Types.Scalars['String']['input'];
  childCkTypeId: Types.Scalars['String']['input'];
  childDirection: Types.GraphDirectionDto;
  grandChildRoleId: Types.Scalars['String']['input'];
  grandChildCkTypeId: Types.Scalars['String']['input'];
  grandChildDirection: Types.GraphDirectionDto;
  mappingRoleId: Types.Scalars['String']['input'];
  mappingCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetMappingCoverageNodeQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', ownMappings?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null, children?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', grandChildren?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null, mappings?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetMappingCoverageNodeDocumentDto = gql`
    query getMappingCoverageNode($rtId: OctoObjectId!, $ckTypeId: String!, $childRoleId: String!, $childCkTypeId: String!, $childDirection: GraphDirection!, $grandChildRoleId: String!, $grandChildCkTypeId: String!, $grandChildDirection: GraphDirection!, $mappingRoleId: String!, $mappingCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId) {
      items {
        rtId
        ckTypeId
        rtWellKnownName
        attributes(attributeNames: ["name", "description"]) {
          items {
            attributeName
            value
          }
        }
        associations {
          ownMappings: targets(
            roleId: $mappingRoleId
            ckId: $mappingCkTypeId
            direction: INBOUND
          ) {
            totalCount
          }
          children: targets(
            roleId: $childRoleId
            ckId: $childCkTypeId
            direction: $childDirection
          ) {
            totalCount
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
                grandChildren: targets(
                  roleId: $grandChildRoleId
                  ckId: $grandChildCkTypeId
                  direction: $grandChildDirection
                ) {
                  totalCount
                }
                mappings: targets(
                  roleId: $mappingRoleId
                  ckId: $mappingCkTypeId
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
  export class GetMappingCoverageNodeDtoGQL extends Apollo.Query<GetMappingCoverageNodeQueryDto, GetMappingCoverageNodeQueryVariablesDto> {
    document = GetMappingCoverageNodeDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }