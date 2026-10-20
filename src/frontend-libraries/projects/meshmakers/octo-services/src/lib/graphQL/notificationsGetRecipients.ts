import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetRecipientsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  fieldFilter?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sortOrder?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type NotificationsGetRecipientsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationSubscription?: { __typename?: 'SystemNotificationNotificationSubscriptionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any, enabled: boolean, preferences?: { __typename?: 'SystemNotificationNotificationPreference_PreferencesUnionConnection', totalCount?: number | null, pageInfo?: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } | null, items?: Array<{ __typename?: 'SystemNotificationNotificationPreference', rtId: any, ckTypeId: any, subjectId: string, cronExpression: string, timeZone?: string | null, deliveryState?: { __typename?: 'SystemNotificationNotificationDeliveryState_DeliveryStateUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationDeliveryState', rtId: any, ckTypeId: any, subjectId?: string | null, lastRunAt?: any | null, lastSentAt?: any | null, lastError?: string | null } | null> | null } | null } | null> | null } | null } | null> | null } | null } | null };

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