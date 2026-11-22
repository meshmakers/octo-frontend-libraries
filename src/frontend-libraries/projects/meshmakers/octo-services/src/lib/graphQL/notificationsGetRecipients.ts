import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetRecipientsQueryVariablesDto = Exact<{
  rtId: any;
  first?: number | null | undefined;
  after?: string | null | undefined;
  fieldFilter?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sortOrder?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type NotificationsGetRecipientsQueryDto = { runtime: { systemNotificationNotificationSubscription: { items: Array<{ rtId: any, enabled: boolean, preferences: { totalCount: number | null, pageInfo: { hasNextPage: boolean, endCursor: string | null } | null, items: Array<{ rtId: any, ckTypeId: any, subjectId: string, cronExpression: string, timeZone: string | null, deliveryState: { items: Array<{ rtId: any, ckTypeId: any, subjectId: string | null, lastRunAt: any, lastSentAt: any, lastError: string | null } | null> | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetRecipientsDocumentDto = gql`
    query NotificationsGetRecipients($rtId: OctoObjectId!, $first: Int, $after: String, $fieldFilter: [FieldFilter], $sortOrder: [Sort]) {
  runtime {
    systemNotificationNotificationSubscription(rtId: $rtId) {
      items {
        rtId
        enabled
        preferences(
          ckTypeIds: ["System.Notification/NotificationPreference"]
          first: $first
          after: $after
          fieldFilter: $fieldFilter
          sortOrder: $sortOrder
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          items {
            ... on SystemNotificationNotificationPreference {
              rtId
              ckTypeId
              subjectId
              cronExpression
              timeZone
              deliveryState(ckTypeIds: ["System.Notification/NotificationDeliveryState"]) {
                items {
                  ... on SystemNotificationNotificationDeliveryState {
                    rtId
                    ckTypeId
                    subjectId
                    lastRunAt
                    lastSentAt
                    lastError
                  }
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
  export class NotificationsGetRecipientsDtoGQL extends Apollo.Query<NotificationsGetRecipientsQueryDto, NotificationsGetRecipientsQueryVariablesDto> {
    document = NotificationsGetRecipientsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }