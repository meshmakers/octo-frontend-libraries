import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetDataPointMappingsQueryVariablesDto = Exact<{
  ckTypeId: string;
  after?: string | null | undefined;
  first?: number | null | undefined;
  fieldFilters?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sort?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type GetDataPointMappingsQueryDto = { runtime: { runtimeEntities: { totalCount: number | null, pageInfo: { endCursor: string | null, hasNextPage: boolean }, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null, associations: { definitions: { items: Array<{ targetRtId: any, targetCkTypeId: any, originRtId: any, originCkTypeId: any, ckAssociationRoleId: any } | null> | null } | null } | null } | null> | null } | null } | null };

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
        attributes(
          attributeNames: ["name", "enabled", "sourceAttributePath", "targetAttributePath", "mappingExpression"]
          resolveEnumValuesToNames: true
        ) {
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