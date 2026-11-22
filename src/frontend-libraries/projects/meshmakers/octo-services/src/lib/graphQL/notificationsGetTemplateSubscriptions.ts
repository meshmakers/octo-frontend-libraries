import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetTemplateSubscriptionsQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type NotificationsGetTemplateSubscriptionsQueryDto = { runtime: { systemNotificationNotificationTemplate: { items: Array<{ rtId: any, subscriptions: { items: Array<{ rtId: any, ckTypeId: any, name: string, query: { items: Array<
                | { rtId: any, columns: Array<string> }
                | Record<PropertyKey, never>
               | null> | null } | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetTemplateSubscriptionsDocumentDto = gql`
    query notificationsGetTemplateSubscriptions($rtId: OctoObjectId!) {
  runtime {
    systemNotificationNotificationTemplate(rtId: $rtId) {
      items {
        rtId
        subscriptions(
          ckTypeIds: ["System.Notification/NotificationSubscription"]
          first: 1000
        ) {
          items {
            ... on SystemNotificationNotificationSubscription {
              rtId
              ckTypeId
              name
              query(ckTypeIds: ["System/SimpleRtQuery"]) {
                items {
                  ... on SystemSimpleRtQuery {
                    rtId
                    columns
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
  export class NotificationsGetTemplateSubscriptionsDtoGQL extends Apollo.Query<NotificationsGetTemplateSubscriptionsQueryDto, NotificationsGetTemplateSubscriptionsQueryVariablesDto> {
    document = NotificationsGetTemplateSubscriptionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }