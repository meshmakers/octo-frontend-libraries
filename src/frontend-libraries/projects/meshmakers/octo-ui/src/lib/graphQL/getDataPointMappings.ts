import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetDataPointMappingsQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sort?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type GetDataPointMappingsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean }, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null, associations?: { __typename?: 'RtEntityGenericAssociation', definitions?: { __typename?: 'RtAssociationDtoConnection', items?: Array<{ __typename?: 'RtAssociation', targetRtId: any, targetCkTypeId: any, originRtId: any, originCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetDataPointMappingsDocumentDto = gql`
    query getDataPointMappings($ckTypeId: String!, $after: String, $first: Int, $fieldFilters: [FieldFilter], $sort: [Sort]) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      after: $after
      first: $first
      fieldFilter: $fieldFilters
      sortOrder: $sort
    ) {
      totalCount
      pageInfo {
        endCursor
        hasNextPage
      }
      items {
        rtId
        ckTypeId
        rtWellKnownName
        attributes(resolveEnumValuesToNames: true) {
          items {
            attributeName
            value
          }
        }
        associations {
          definitions(direction: OUTBOUND, first: 10) {
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
  export class GetDataPointMappingsDtoGQL extends Apollo.Query<GetDataPointMappingsQueryDto, GetDataPointMappingsQueryVariablesDto> {
    document = GetDataPointMappingsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }