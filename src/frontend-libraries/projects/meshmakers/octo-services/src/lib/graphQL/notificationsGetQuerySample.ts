import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetQuerySampleQueryVariablesDto = Exact<{
  rtId: any;
  first?: number | null | undefined;
}>;


export type NotificationsGetQuerySampleQueryDto = { runtime: { runtimeQuery: { items: Array<{ queryRtId: any, rows: { totalCount: number | null, items: Array<
            | { rtId: any, cells: { items: Array<{ attributePath: string, value: any }> | null } | null }
            | Record<PropertyKey, never>
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