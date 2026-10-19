import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetEmailTemplatesQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type NotificationsGetEmailTemplatesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemNotificationNotificationTemplate?: { __typename?: 'SystemNotificationNotificationTemplateConnection', totalCount?: number | null, pageInfo?: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } | null, items?: Array<{ __typename?: 'SystemNotificationNotificationTemplate', rtId: any, ckTypeId: any, rtWellKnownName?: string | null } | null> | null } | null } | null };

export const NotificationsGetEmailTemplatesDocumentDto = gql`
    query NotificationsGetEmailTemplates($after: String, $first: Int, $searchFilter: SearchFilter) {
  runtime {
    systemNotificationNotificationTemplate(
      after: $after
      first: $first
      searchFilter: $searchFilter
      fieldFilter: [{attributePath: "type", operator: EQUALS, comparisonValue: "E_MAIL"}]
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      items {
        rtId
        ckTypeId
        rtWellKnownName
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsGetEmailTemplatesDtoGQL extends Apollo.Query<NotificationsGetEmailTemplatesQueryDto, NotificationsGetEmailTemplatesQueryVariablesDto> {
    document = NotificationsGetEmailTemplatesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }