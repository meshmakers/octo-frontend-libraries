import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetPreferenceQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type NotificationsGetPreferenceQueryDto = { runtime: { systemNotificationNotificationPreference: { items: Array<{ rtId: any, ckTypeId: any, subjectId: string, cronExpression: string, timeZone: string | null, deliveryState: { items: Array<{ rtId: any, ckTypeId: any, subjectId: string | null, lastRunAt: any, lastSentAt: any, lastError: string | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetPreferenceDocumentDto = gql`
    query NotificationsGetPreference($rtId: OctoObjectId!) {
  runtime {
    systemNotificationNotificationPreference(rtId: $rtId) {
      items {
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
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsGetPreferenceDtoGQL extends Apollo.Query<NotificationsGetPreferenceQueryDto, NotificationsGetPreferenceQueryVariablesDto> {
    document = NotificationsGetPreferenceDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }