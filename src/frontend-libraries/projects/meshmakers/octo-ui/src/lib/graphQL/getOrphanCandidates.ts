import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetOrphanCandidatesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  mapsFromRoleId: Types.Scalars['String']['input'];
  mappingCkTypeId: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type GetOrphanCandidatesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', mappings?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null } | null> | null } | null } | null };

export const GetOrphanCandidatesDocumentDto = gql`
    query getOrphanCandidates($ckTypeId: String!, $mapsFromRoleId: String!, $mappingCkTypeId: String!, $first: Int, $after: String, $searchFilter: SearchFilter) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      first: $first
      after: $after
      searchFilter: $searchFilter
    ) {
      totalCount
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
          mappings: targets(
            roleId: $mapsFromRoleId
            ckId: $mappingCkTypeId
            direction: INBOUND
            first: 1
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
  export class GetOrphanCandidatesDtoGQL extends Apollo.Query<GetOrphanCandidatesQueryDto, GetOrphanCandidatesQueryVariablesDto> {
    document = GetOrphanCandidatesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }