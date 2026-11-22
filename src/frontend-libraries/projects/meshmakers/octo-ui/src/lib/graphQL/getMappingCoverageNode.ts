import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetMappingCoverageNodeQueryVariablesDto = Exact<{
  rtId: any;
  ckTypeId: string;
  childRoleId: string;
  childCkTypeId: string;
  childDirection: Types.GraphDirectionDto;
  grandChildRoleId: string;
  grandChildCkTypeId: string;
  grandChildDirection: Types.GraphDirectionDto;
  mappingRoleId: string;
  mappingCkTypeId: string;
}>;


export type GetMappingCoverageNodeQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { ownMappings: { totalCount: number | null } | null, children: { totalCount: number | null, items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { grandChildren: { totalCount: number | null } | null, mappings: { totalCount: number | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetMappingCoverageNodeDocumentDto = gql`
    query getMappingCoverageNode($rtId: OctoObjectId!, $ckTypeId: String!, $childRoleId: String!, $childCkTypeId: String!, $childDirection: GraphDirection!, $grandChildRoleId: String!, $grandChildCkTypeId: String!, $grandChildDirection: GraphDirection!, $mappingRoleId: String!, $mappingCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId) {
      items {
        rtId
        rtDisplayName
        rtDisplayDescription
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
              rtDisplayName
              rtDisplayDescription
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