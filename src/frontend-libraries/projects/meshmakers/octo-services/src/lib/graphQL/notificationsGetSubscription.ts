import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetSubscriptionQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type NotificationsGetSubscriptionQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationSubscription?: { __typename?: 'SystemNotificationNotificationSubscriptionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any, ckTypeId: any, name: string, description?: string | null, enabled: boolean, query?: { __typename?: 'SystemPersistentQuery_QueryUnionConnection', items?: Array<
            | { __typename?: 'SystemAggregationRtQuery' }
            | { __typename?: 'SystemAggregationSdQuery' }
            | { __typename?: 'SystemDownsamplingSdQuery' }
            | { __typename?: 'SystemGroupingAggregationRtQuery' }
            | { __typename?: 'SystemGroupingAggregationSdQuery' }
            | { __typename?: 'SystemSimpleRtQuery', rtId: any, ckTypeId: any, name: string }
            | { __typename?: 'SystemSimpleSdQuery' }
           | null> | null } | null, template?: { __typename?: 'SystemNotificationNotificationTemplate_TemplateUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationTemplate', rtId: any, ckTypeId: any, rtWellKnownName?: string | null } | null> | null } | null } | null> | null } | null } | null };

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