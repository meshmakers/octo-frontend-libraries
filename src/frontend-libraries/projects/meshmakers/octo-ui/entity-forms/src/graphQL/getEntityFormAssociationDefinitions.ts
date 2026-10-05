import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetAssociationDefinitionsQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  rtId: Types.Scalars['OctoObjectId']['input'];
  roleId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type EntityFormGetAssociationDefinitionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, associations?: { __typename?: 'RtEntityGenericAssociation', definitions?: { __typename?: 'RtAssociationDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtAssociation', originRtId: any, originCkTypeId: any, targetRtId: any, targetCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const EntityFormGetAssociationDefinitionsDocumentDto = gql`
    query entityFormGetAssociationDefinitions($ckTypeId: String!, $rtId: OctoObjectId!, $roleId: String!, $direction: GraphDirection!, $first: Int) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId, first: 1) {
      items {
        rtId
        associations {
          definitions(direction: $direction, roleId: $roleId, first: $first) {
            totalCount
            items {
              originRtId
              originCkTypeId
              targetRtId
              targetCkTypeId
              ckAssociationRoleId
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
  export class EntityFormGetAssociationDefinitionsDtoGQL extends Apollo.Query<EntityFormGetAssociationDefinitionsQueryDto, EntityFormGetAssociationDefinitionsQueryVariablesDto> {
    document = EntityFormGetAssociationDefinitionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }