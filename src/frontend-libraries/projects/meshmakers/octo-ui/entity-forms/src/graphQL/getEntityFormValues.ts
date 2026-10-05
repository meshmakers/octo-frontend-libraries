import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetValuesQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  rtId?: Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>;
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  attributeNames: Array<Types.InputMaybe<Types.Scalars['String']['input']>> | Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type EntityFormGetValuesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, rtDisplayName: string, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null };

export const EntityFormGetValuesDocumentDto = gql`
    query entityFormGetValues($ckTypeId: String!, $rtId: OctoObjectId, $fieldFilters: [FieldFilter], $attributeNames: [String]!) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      rtId: $rtId
      fieldFilter: $fieldFilters
      first: 1
    ) {
      totalCount
      items {
        rtId
        ckTypeId
        rtWellKnownName
        rtDisplayName
        rtCreationDateTime
        rtChangedDateTime
        attributes(attributeNames: $attributeNames) {
          items {
            attributeName
            value
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
  export class EntityFormGetValuesDtoGQL extends Apollo.Query<EntityFormGetValuesQueryDto, EntityFormGetValuesQueryVariablesDto> {
    document = EntityFormGetValuesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }