import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type EntityFormGetCountQueryVariablesDto = Types.Exact<{
  ckTypeId: Types.Scalars['String']['input'];
  fieldFilters?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
}>;


export type EntityFormGetCountQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', totalCount?: number | null } | null } | null };

export const EntityFormGetCountDocumentDto = gql`
    query entityFormGetCount($ckTypeId: String!, $fieldFilters: [FieldFilter]) {
  runtime {
    runtimeEntities(ckId: $ckTypeId, first: 1, fieldFilter: $fieldFilters) {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class EntityFormGetCountDtoGQL extends Apollo.Query<EntityFormGetCountQueryDto, EntityFormGetCountQueryVariablesDto> {
    document = EntityFormGetCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }