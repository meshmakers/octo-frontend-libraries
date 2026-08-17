import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetOrphanCandidatesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  mapsFromRoleId: Types.Scalars['String']['input'];
  mappingCkTypeId: Types.Scalars['String']['input'];
  childRoleId: Types.Scalars['String']['input'];
  childCkTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type GetOrphanCandidatesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items?: Array<{ __typename?: 'RtEntity', rtId: any, rtDisplayName: string, rtDisplayDescription?: string | null, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', mappings?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null, parent?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, rtDisplayName: string, rtDisplayDescription?: string | null, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', parent?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, rtDisplayName: string, rtDisplayDescription?: string | null, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', parent?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, rtDisplayName: string, rtDisplayDescription?: string | null, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

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