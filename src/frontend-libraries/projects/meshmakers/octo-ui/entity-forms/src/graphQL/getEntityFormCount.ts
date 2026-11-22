import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetCountQueryVariablesDto = Exact<{
  ckTypeId: string;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
}>;


export type EntityFormGetCountQueryDto = { runtime: { runtimeEntities: { totalCount: number | null } | null } | null };

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