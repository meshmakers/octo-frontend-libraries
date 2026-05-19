import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetNodeMappingsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  mapsToRoleId: Types.Scalars['String']['input'];
  mapsFromRoleId: Types.Scalars['String']['input'];
  mappingCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetNodeMappingsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, associations?: { __typename?: 'RtEntityGenericAssociation', mappings?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', sources?: { __typename?: 'RtAssociationDtoConnection', items?: Array<{ __typename?: 'RtAssociation', targetRtId: any, targetCkTypeId: any } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetNodeMappingsDocumentDto = gql`
    query getNodeMappings($rtId: OctoObjectId!, $ckTypeId: String!, $mapsToRoleId: String!, $mapsFromRoleId: String!, $mappingCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId) {
      items {
        rtId
        ckTypeId
        associations {
          mappings: targets(
            roleId: $mapsToRoleId
            ckId: $mappingCkTypeId
            direction: INBOUND
          ) {
            totalCount
            items {
              rtId
              ckTypeId
              attributes(resolveEnumValuesToNames: true) {
                items {
                  attributeName
                  value
                }
              }
              associations {
                sources: definitions(roleId: $mapsFromRoleId, direction: OUTBOUND, first: 1) {
                  items {
                    targetRtId
                    targetCkTypeId
                  }
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
  export class GetNodeMappingsDtoGQL extends Apollo.Query<GetNodeMappingsQueryDto, GetNodeMappingsQueryVariablesDto> {
    document = GetNodeMappingsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }