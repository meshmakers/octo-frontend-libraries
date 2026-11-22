import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type TransientDownsamplingQueryVariablesDto = Exact<{
  archiveRtId: any;
  from: any;
  to: any;
  limit: number;
  columnPaths: Array<Types.StreamDataQueryColumnInputDto> | Types.StreamDataQueryColumnInputDto;
  rtIds?: Array<any> | any | null | undefined;
  fieldFilter?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
}>;


export type TransientDownsamplingQueryDto = { streamData: { transientStreamDataQuery: { downsampling: { items: Array<{ rows: { totalCount: number | null, items: Array<{ rtId: any, timestamp: any, cells: { items: Array<{ attributePath: string, value: any }> | null } | null }> | null } | null }> | null } | null } } | null };

export const TransientDownsamplingDocumentDto = gql`
    query transientDownsampling($archiveRtId: OctoObjectId!, $from: DateTime!, $to: DateTime!, $limit: Int!, $columnPaths: [StreamDataQueryColumnInput!]!, $rtIds: [OctoObjectId], $fieldFilter: [FieldFilter]) {
  streamData {
    transientStreamDataQuery {
      downsampling(
        archiveRtId: $archiveRtId
        from: $from
        to: $to
        limit: $limit
        columnPaths: $columnPaths
        rtIds: $rtIds
        fieldFilter: $fieldFilter
      ) {
        items {
          rows {
            totalCount
            items {
              rtId
              timestamp
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
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class TransientDownsamplingDtoGQL extends Apollo.Query<TransientDownsamplingQueryDto, TransientDownsamplingQueryVariablesDto> {
    document = TransientDownsamplingDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }