import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetDashboardEntityQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  ckTypeId: Types.Scalars['String']['input'];
}>;


export type GetDashboardEntityQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', definitions?: { __typename?: 'RtAssociationDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtAssociation', targetRtId: any, targetCkTypeId: any, originRtId: any, originCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetDashboardEntityDocumentDto = gql`
    query getDashboardEntity($rtId: OctoObjectId!, $ckTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $rtId, ckId: $ckTypeId, first: 1) {
      items {
        rtId
        ckTypeId
        rtWellKnownName
        rtCreationDateTime
        rtChangedDateTime
        attributes(resolveEnumValuesToNames: true) {
          items {
            attributeName
            value
          }
        }
        associations {
          definitions(direction: ANY) {
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
  export class GetDashboardEntityDtoGQL extends Apollo.Query<GetDashboardEntityQueryDto, GetDashboardEntityQueryVariablesDto> {
    document = GetDashboardEntityDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }