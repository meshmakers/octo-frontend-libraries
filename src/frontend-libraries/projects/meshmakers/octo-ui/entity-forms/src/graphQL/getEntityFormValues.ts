import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type EntityFormGetValuesQueryVariablesDto = Exact<{
  ckTypeId: string;
  rtId?: any;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  attributeNames: Array<string | null | undefined> | string;
}>;


export type EntityFormGetValuesQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, rtDisplayName: string, rtCreationDateTime: any, rtChangedDateTime: any, attributes: { items: Array<{ attributeName: string | null, value: any, secretIsSet: boolean | null, secretKeyMissing: boolean | null, secretSetAt: any } | null> | null } | null } | null> | null } | null } | null };

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
            secretIsSet
            secretKeyMissing
            secretSetAt
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