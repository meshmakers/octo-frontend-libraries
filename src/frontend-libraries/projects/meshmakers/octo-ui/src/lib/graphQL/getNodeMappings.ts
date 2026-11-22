import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetNodeMappingsQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  mapsToRoleId: string;
  mapsFromRoleId: string;
  mappingCkTypeId: string;
}>;


export type GetNodeMappingsQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, ckTypeId: any, associations: { mappings: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { sources: { items: Array<{ targetRtId: any, targetCkTypeId: any } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

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
              attributes(
                attributeNames: ["name", "enabled", "sourceAttributePath", "targetAttributePath", "mappingExpression"]
                resolveEnumValuesToNames: true
              ) {
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