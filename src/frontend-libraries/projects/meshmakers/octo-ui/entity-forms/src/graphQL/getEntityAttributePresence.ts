import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetAttributePresenceQueryVariablesDto = Exact<{
  ckTypeId: string;
  rtId: any;
  fieldFilters: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto;
}>;


export type EntityFormGetAttributePresenceQueryDto = { runtime: { runtimeEntities: { totalCount: number | null } | null } | null };

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