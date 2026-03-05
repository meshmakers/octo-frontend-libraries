import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetAssociationTargetsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  targetCkTypeId: Types.Scalars['String']['input'];
  roleId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  attributeNames?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['String']['input']>> | Types.InputMaybe<Types.Scalars['String']['input']>>;
}>;


export type GetAssociationTargetsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetAssociationTargetsDocumentDto = gql`
    query getAssociationTargets($rtId: OctoObjectId!, $ckTypeId: String!, $targetCkTypeId: String!, $roleId: String!, $direction: GraphDirection!, $first: Int, $attributeNames: [String]) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId, first: 1) {
      items {
        associations {
          targets(
            ckId: $targetCkTypeId
            roleId: $roleId
            direction: $direction
            first: $first
          ) {
            totalCount
            items {
              rtId
              ckTypeId
              rtWellKnownName
              attributes(attributeNames: $attributeNames, resolveEnumValuesToNames: true) {
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
  export class GetAssociationTargetsDtoGQL extends Apollo.Query<GetAssociationTargetsQueryDto, GetAssociationTargetsQueryVariablesDto> {
    document = GetAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }