import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetRuntimeEntityAssociationsByIdQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
  direction: Types.GraphDirectionDto;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  roleId?: Types.InputMaybe<Types.Scalars['String']['input']>;
  relatedRtCkId?: Types.InputMaybe<Types.Scalars['RtCkTypeId']['input']>;
  relatedRtId?: Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>;
}>;


export type GetRuntimeEntityAssociationsByIdQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, associations?: { __typename?: 'RtEntityGenericAssociation', definitions?: { __typename?: 'RtAssociationDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtAssociation', targetRtId: any, targetCkTypeId: any, originRtId: any, originCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetRuntimeEntityAssociationsByIdDocumentDto = gql`
    query getRuntimeEntityAssociationsById($rtId: OctoObjectId!, $ckTypeId: String!, $direction: GraphDirection!, $after: String, $first: Int, $roleId: String, $relatedRtCkId: RtCkTypeId, $relatedRtId: OctoObjectId) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, rtId: $rtId) {
      items {
        rtId
        ckTypeId
        associations {
          definitions(
            direction: $direction
            roleId: $roleId
            relatedRtCkId: $relatedRtCkId
            relatedRtId: $relatedRtId
            after: $after
            first: $first
          ) {
            totalCount
            items {
              targetRtId
              targetCkTypeId
              originRtId
              originCkTypeId
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
  export class GetRuntimeEntityAssociationsByIdDtoGQL extends Apollo.Query<GetRuntimeEntityAssociationsByIdQueryDto, GetRuntimeEntityAssociationsByIdQueryVariablesDto> {
    document = GetRuntimeEntityAssociationsByIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }