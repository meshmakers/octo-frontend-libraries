import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetAttributePresenceQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  rtId: Types.Scalars['OctoObjectId']['input'];
  fieldFilters: Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>;
}>;


export type EntityFormGetAttributePresenceQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null };

export const EntityFormGetAttributePresenceDocumentDto = gql`
    query entityFormGetAttributePresence($ckTypeId: String!, $rtId: OctoObjectId!, $fieldFilters: [FieldFilter]!) {
  runtime {
    runtimeEntities(
      ckId: $ckTypeId
      rtId: $rtId
      fieldFilter: $fieldFilters
      first: 1
    ) {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetAttributePresenceDtoGQL extends Apollo.Query<EntityFormGetAttributePresenceQueryDto, EntityFormGetAttributePresenceQueryVariablesDto> {
    document = EntityFormGetAttributePresenceDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }