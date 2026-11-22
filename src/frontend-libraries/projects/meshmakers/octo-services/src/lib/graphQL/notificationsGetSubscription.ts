import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetSubscriptionQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type NotificationsGetSubscriptionQueryDto = { runtime: { systemNotificationNotificationSubscription: { items: Array<{ rtId: any, ckTypeId: any, name: string, description: string | null, enabled: boolean, query: { items: Array<
            | { rtId: any, ckTypeId: any, name: string }
            | Record<PropertyKey, never>
           | null> | null } | null, template: { items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetSubscriptionDocumentDto = gql`
    query NotificationsGetSubscription($rtId: OctoObjectId!) {
  runtime {
    systemNotificationNotificationSubscription(rtId: $rtId) {
      items {
        rtId
        ckTypeId
        name
        description
        enabled
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
  export class NotificationsGetSubscriptionDtoGQL extends Apollo.Query<NotificationsGetSubscriptionQueryDto, NotificationsGetSubscriptionQueryVariablesDto> {
    document = NotificationsGetSubscriptionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }