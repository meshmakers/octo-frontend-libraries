import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetTreeAssociationTargetsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  roleId: Types.Scalars['String']['input'];
  targetCkTypeId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetTreeAssociationTargetsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, rtDisplayName: string, rtDisplayDescription?: string | null, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetTreeAssociationTargetsDocumentDto = gql`
    query getTreeAssociationTargets($rtId: OctoObjectId!, $ckTypeId: String!, $roleId: String!, $targetCkTypeId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId, first: 1) {
      items {
        associations {
          targets(
            roleId: $roleId
            ckId: $targetCkTypeId
            direction: $direction
            first: $first
          ) {
            totalCount
            items {
              rtId
              rtDisplayName
              rtDisplayDescription
              ckTypeId
              rtWellKnownName
              attributes(
                attributeNames: ["name", "displayName", "description"]
                resolveEnumValuesToNames: true
              ) {
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
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetTreeAssociationTargetsDtoGQL extends Apollo.Query<GetTreeAssociationTargetsQueryDto, GetTreeAssociationTargetsQueryVariablesDto> {
    document = GetTreeAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }