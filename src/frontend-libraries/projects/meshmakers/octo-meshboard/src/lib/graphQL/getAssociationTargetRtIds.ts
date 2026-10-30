import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetAssociationTargetRtIdsQueryVariablesDto = Types.Exact<{
  rtIds: Array<Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>> | Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>;
  ckTypeId: Types.Scalars['String']['input'];
  targetCkTypeId: Types.Scalars['String']['input'];
  roleId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  first: Types.Scalars['Int']['input'];
  targetsFirst: Types.Scalars['Int']['input'];
}>;


export type GetAssociationTargetRtIdsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, associations?: { __typename?: 'RtEntityGenericAssociation', targets?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetAssociationTargetRtIdsDocumentDto = gql`
    query getAssociationTargetRtIds($rtIds: [OctoObjectId]!, $ckTypeId: String!, $targetCkTypeId: String!, $roleId: String!, $direction: GraphDirection!, $first: Int!, $targetsFirst: Int!) {
  runtime {
    runtimeEntities(rtIds: $rtIds, ckId: $ckTypeId, first: $first) {
      items {
        rtId
        associations {
          targets(
            ckId: $targetCkTypeId
            roleId: $roleId
            direction: $direction
            first: $targetsFirst
          ) {
            totalCount
            items {
              rtId
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
  export class GetAssociationTargetRtIdsDtoGQL extends Apollo.Query<GetAssociationTargetRtIdsQueryDto, GetAssociationTargetRtIdsQueryVariablesDto> {
    document = GetAssociationTargetRtIdsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }