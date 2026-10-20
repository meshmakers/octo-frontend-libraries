import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetTemplateSubscriptionsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type NotificationsGetTemplateSubscriptionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationTemplate?: { __typename?: 'SystemNotificationNotificationTemplateConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationTemplate', rtId: any, subscriptions?: { __typename?: 'SystemNotificationNotificationSubscription_SubscriptionsUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any, ckTypeId: any, name: string, query?: { __typename?: 'SystemPersistentQuery_QueryUnionConnection', items?: Array<
                | { __typename?: 'SystemAggregationRtQuery' }
                | { __typename?: 'SystemAggregationSdQuery' }
                | { __typename?: 'SystemDownsamplingSdQuery' }
                | { __typename?: 'SystemGroupingAggregationRtQuery' }
                | { __typename?: 'SystemGroupingAggregationSdQuery' }
                | { __typename?: 'SystemSimpleRtQuery', rtId: any, columns: Array<string> }
                | { __typename?: 'SystemSimpleSdQuery' }
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