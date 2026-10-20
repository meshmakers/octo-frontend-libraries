import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetQuerySampleQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type NotificationsGetQuerySampleQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeQuery?: { __typename?: 'RtQueryDtoConnection', items?: Array<{ __typename?: 'RtQuery', queryRtId: any, rows?: { __typename?: 'RtQueryRowDtoConnection', totalCount?: number | null, items?: Array<
            | { __typename?: 'RtAggregationQueryRow' }
            | { __typename?: 'RtGroupingAggregationQueryRow' }
            | { __typename?: 'RtSimpleQueryRow', rtId?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }
          > | null } | null }> | null } | null } | null };

export const NotificationsGetQuerySampleDocumentDto = gql`
    query notificationsGetQuerySample($rtId: OctoObjectId!, $first: Int) {
  runtime {
    runtimeQuery(rtId: $rtId) {
      items {
        queryRtId
        rows(first: $first) {
          totalCount
          items {
            ... on RtSimpleQueryRow {
              rtId
              cells(first: 1000) {
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
  export class NotificationsGetQuerySampleDtoGQL extends Apollo.Query<NotificationsGetQuerySampleQueryDto, NotificationsGetQuerySampleQueryVariablesDto> {
    document = NotificationsGetQuerySampleDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }