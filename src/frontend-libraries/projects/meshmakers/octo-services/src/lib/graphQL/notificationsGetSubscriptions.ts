import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetSubscriptionsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
  fieldFilter?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
  sortOrder?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
}>;


export type NotificationsGetSubscriptionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationSubscription?: { __typename?: 'SystemNotificationNotificationSubscriptionConnection', totalCount?: number | null, pageInfo?: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } | null, items?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any, ckTypeId: any, name: string, enabled: boolean, preferences?: { __typename?: 'SystemNotificationNotificationPreference_PreferencesUnionConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemNotificationNotificationPreference', rtId: any, ckTypeId: any, deliveryState?: { __typename?: 'SystemNotificationNotificationDeliveryState_DeliveryStateUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationDeliveryState', rtId: any, ckTypeId: any, lastRunAt?: any | null, lastError?: string | null } | null> | null } | null } | null> | null } | null, query?: { __typename?: 'SystemPersistentQuery_QueryUnionConnection', items?: Array<
            | { __typename?: 'SystemAggregationRtQuery' }
            | { __typename?: 'SystemAggregationSdQuery' }
            | { __typename?: 'SystemDownsamplingSdQuery' }
            | { __typename?: 'SystemGroupingAggregationRtQuery' }
            | { __typename?: 'SystemGroupingAggregationSdQuery' }
            | { __typename?: 'SystemSimpleRtQuery', rtId: any, ckTypeId: any, name: string }
            | { __typename?: 'SystemSimpleSdQuery' }
           | null> | null } | null, template?: { __typename?: 'SystemNotificationNotificationTemplate_TemplateUnionConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationTemplate', rtId: any, ckTypeId: any, rtWellKnownName?: string | null } | null> | null } | null } | null> | null } | null } | null };

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