import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetSubscriptionsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
  searchFilter?: Types.SearchFilterDto | null | undefined;
  fieldFilter?: Array<Types.FieldFilterDto | null | undefined> | Types.FieldFilterDto | null | undefined;
  sortOrder?: Array<Types.SortDto | null | undefined> | Types.SortDto | null | undefined;
}>;


export type NotificationsGetSubscriptionsQueryDto = { runtime: { systemNotificationNotificationSubscription: { totalCount: number | null, pageInfo: { hasNextPage: boolean, endCursor: string | null } | null, items: Array<{ rtId: any, ckTypeId: any, name: string, enabled: boolean, preferences: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, deliveryState: { items: Array<{ rtId: any, ckTypeId: any, lastRunAt: any, lastError: string | null } | null> | null } | null } | null> | null } | null, query: { items: Array<
            | { rtId: any, ckTypeId: any, name: string }
            | Record<PropertyKey, never>
           | null> | null } | null, template: { items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetSubscriptionsDocumentDto = gql`
    query NotificationsGetSubscriptions($first: Int, $after: String, $searchFilter: SearchFilter, $fieldFilter: [FieldFilter], $sortOrder: [Sort]) {
  runtime {
    systemNotificationNotificationSubscription(
      first: $first
      after: $after
      searchFilter: $searchFilter
      fieldFilter: $fieldFilter
      sortOrder: $sortOrder
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      items {
        rtId
        ckTypeId
        name
        enabled
        preferences(
          ckTypeIds: ["System.Notification/NotificationPreference"]
          first: 1000
        ) {
          totalCount
          items {
            ... on SystemNotificationNotificationPreference {
              rtId
              ckTypeId
              deliveryState(ckTypeIds: ["System.Notification/NotificationDeliveryState"]) {
                items {
                  ... on SystemNotificationNotificationDeliveryState {
                    rtId
                    ckTypeId
                    lastRunAt
                    lastError
                  }
                }
              }
            }
          }
        }
        query(ckTypeIds: ["System/SimpleRtQuery"]) {
          items {
            ... on SystemSimpleRtQuery {
              rtId
              ckTypeId
              name
            }
          }
        }
        template(ckTypeIds: ["System.Notification/NotificationTemplate"]) {
          items {
            ... on SystemNotificationNotificationTemplate {
              rtId
              ckTypeId
              rtWellKnownName
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
  export class NotificationsGetSubscriptionsDtoGQL extends Apollo.Query<NotificationsGetSubscriptionsQueryDto, NotificationsGetSubscriptionsQueryVariablesDto> {
    document = NotificationsGetSubscriptionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }