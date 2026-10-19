import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetPreferenceQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type NotificationsGetPreferenceQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationPreference?: { __typename?: 'SystemNotificationNotificationPreferenceConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationPreference', rtId: any, ckTypeId: any, subjectId: string, cronExpression: string, skipExistingRows: boolean, timeZone?: string | null, deliveryState?: { __typename?: 'SystemNotificationNotificationDeliveryState_DeliveryStateUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationDeliveryState', rtId: any, ckTypeId: any, subjectId?: string | null, lastRunAt?: any | null, lastSentAt?: any | null, lastError?: string | null, runningSince?: any | null } | null> | null } | null } | null> | null } | null } | null };

export const NotificationsGetPreferenceDocumentDto = gql`
    query NotificationsGetPreference($rtId: OctoObjectId!) {
  runtime {
    systemNotificationNotificationPreference(rtId: $rtId) {
      items {
        rtId
        ckTypeId
        subjectId
        cronExpression
        skipExistingRows
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
              runningSince
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