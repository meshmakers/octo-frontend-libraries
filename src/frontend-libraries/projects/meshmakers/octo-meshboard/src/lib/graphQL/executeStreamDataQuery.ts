import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type ExecuteStreamDataQueryQueryVariablesDto = Exact<{
  rtId: any;
  arg?: Types.StreamDataArgumentsDto | null | undefined;
  first?: number | null | undefined;
  after?: string | null | undefined;
  sortOrder?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
  fieldFilter?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
}>;


export type ExecuteStreamDataQueryQueryDto = { streamData: { streamDataQuery: { items: Array<{ queryRtId: any, associatedCkTypeId: any, columns: Array<{ attributePath: string | null, attributeValueType: Types.AttributeValueTypeDto | null, aggregationType: Types.AggregationTypesDto | null }>, rows: { totalCount: number | null, pageInfo: { hasNextPage: boolean, endCursor: string | null }, items: Array<{ rtId: any, ckTypeId: any, timestamp: any, rtWellKnownName: string | null, rtCreationDateTime: any, rtChangedDateTime: any, cells: { items: Array<{ attributePath: string, value: any }> | null } | null }> | null } | null }> | null } | null } | null };

export const ExecuteStreamDataQueryDocumentDto = gql`
    query executeStreamDataQuery($rtId: OctoObjectId!, $arg: StreamDataArguments, $first: Int, $after: String, $sortOrder: [Sort], $fieldFilter: [FieldFilter]) {
  streamData {
    streamDataQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        columns {
          attributePath
          attributeValueType
          aggregationType
        }
        rows(
          arg: $arg
          first: $first
          after: $after
          sortOrder: $sortOrder
          fieldFilter: $fieldFilter
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          items {
            rtId
            ckTypeId
            timestamp
            rtWellKnownName
            rtCreationDateTime
            rtChangedDateTime
            cells {
              items {
                attributePath
                value
              }
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
  export class ExecuteStreamDataQueryDtoGQL extends Apollo.Query<ExecuteStreamDataQueryQueryDto, ExecuteStreamDataQueryQueryVariablesDto> {
    document = ExecuteStreamDataQueryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }