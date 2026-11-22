import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type ExecuteRuntimeQueryQueryVariablesDto = Exact<{
  rtId: any;
  after?: string | null | undefined;
  first?: number | null | undefined;
  fieldFilter?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
}>;


export type ExecuteRuntimeQueryQueryDto = { runtime: { runtimeQuery: { items: Array<{ queryRtId: any, associatedCkTypeId: any, columns: Array<{ attributePath: string | null, attributeValueType: Types.AttributeValueTypeDto | null, aggregationType: Types.AggregationTypesDto | null }>, rows: { totalCount: number | null, items: Array<
            | { ckTypeId: any, cells: { totalCount: number | null, items: Array<{ attributePath: string, value: any }> | null } | null }
            | { ckTypeId: any, cells: { totalCount: number | null, items: Array<{ attributePath: string, value: any }> | null } | null }
            | { rtId: any, ckTypeId: any, cells: { totalCount: number | null, items: Array<{ attributePath: string, value: any }> | null } | null }
          > | null, pageInfo: { hasNextPage: boolean, endCursor: string | null } } | null }> | null } | null } | null };

export const ExecuteRuntimeQueryDocumentDto = gql`
    query executeRuntimeQuery($rtId: OctoObjectId!, $after: String, $first: Int, $fieldFilter: [FieldFilter]) {
  runtime {
    runtimeQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        columns {
          attributePath
          attributeValueType
          aggregationType
        }
        rows(after: $after, first: $first, fieldFilter: $fieldFilter) {
          totalCount
          items {
            ... on RtSimpleQueryRow {
              rtId
            }
            ckTypeId
            cells {
              totalCount
              items {
                attributePath
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
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
  export class ExecuteRuntimeQueryDtoGQL extends Apollo.Query<ExecuteRuntimeQueryQueryDto, ExecuteRuntimeQueryQueryVariablesDto> {
    document = ExecuteRuntimeQueryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }