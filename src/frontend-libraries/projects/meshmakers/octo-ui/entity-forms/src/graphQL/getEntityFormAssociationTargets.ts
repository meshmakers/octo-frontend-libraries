import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetAssociationTargetsQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  rtId: Types.Scalars['OctoObjectId']['input'];
  roleId: Types.Scalars['String']['input'];
  targetCkTypeId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type EntityFormGetAssociationTargetsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtDisplayName: string, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const EntityFormGetAssociationTargetsDocumentDto = gql`
    query entityFormGetAssociationTargets($ckTypeId: String!, $rtId: OctoObjectId!, $roleId: String!, $targetCkTypeId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId, first: 1) {
      items {
        rtId
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
              ckTypeId
              rtWellKnownName
              rtDisplayName
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
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetAssociationTargetsDtoGQL extends Apollo.Query<EntityFormGetAssociationTargetsQueryDto, EntityFormGetAssociationTargetsQueryVariablesDto> {
    document = EntityFormGetAssociationTargetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }