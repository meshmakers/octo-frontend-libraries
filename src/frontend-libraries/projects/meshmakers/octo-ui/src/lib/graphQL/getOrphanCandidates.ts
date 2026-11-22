import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetOrphanCandidatesQueryVariablesDto = Exact<{
  ckTypeId: string;
  mapsFromRoleId: string;
  mappingCkTypeId: string;
  childRoleId: string;
  childCkTypeId: string;
  first?: number | null | undefined;
  after?: string | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
}>;


export type GetOrphanCandidatesQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, pageInfo: { hasNextPage: boolean, endCursor: string | null }, items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { mappings: { totalCount: number | null } | null, parent: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { parent: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { parent: { items: Array<{ rtId: any, rtDisplayName: string, rtDisplayDescription: string | null, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetOrphanCandidatesDocumentDto = gql`
    query getOrphanCandidates($ckTypeId: String!, $mapsFromRoleId: String!, $mappingCkTypeId: String!, $childRoleId: String!, $childCkTypeId: String!, $first: Int, $after: String, $searchFilter: SearchFilter) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      first: $first
      after: $after
      searchFilter: $searchFilter
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
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
          mappings: targets(
            roleId: $mapsFromRoleId
            ckId: $mappingCkTypeId
            direction: INBOUND
            first: 1
          ) {
            totalCount
          }
          parent: targets(
            roleId: $childRoleId
            ckId: $childCkTypeId
            direction: OUTBOUND
            first: 1
          ) {
            items {
              rtId
              rtDisplayName
              rtDisplayDescription
              ckTypeId
              rtWellKnownName
              attributes(attributeNames: ["name"]) {
                items {
                  attributeName
                  value
                }
              }
              associations {
                parent: targets(
                  roleId: $childRoleId
                  ckId: $childCkTypeId
                  direction: OUTBOUND
                  first: 1
                ) {
                  items {
                    rtId
                    rtDisplayName
                    rtDisplayDescription
                    ckTypeId
                    rtWellKnownName
                    attributes(attributeNames: ["name"]) {
                      items {
                        attributeName
                        value
                      }
                    }
                    associations {
                      parent: targets(
                        roleId: $childRoleId
                        ckId: $childCkTypeId
                        direction: OUTBOUND
                        first: 1
                      ) {
                        items {
                          rtId
                          rtDisplayName
                          rtDisplayDescription
                          ckTypeId
                          rtWellKnownName
                          attributes(attributeNames: ["name"]) {
                            items {
                              attributeName
                              value
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
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetOrphanCandidatesDtoGQL extends Apollo.Query<GetOrphanCandidatesQueryDto, GetOrphanCandidatesQueryVariablesDto> {
    document = GetOrphanCandidatesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }