import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetPlaceholderSourcesQueryVariablesDto = Types.Exact<{
  queryRtId: Types.Scalars['OctoObjectId']['input'];
  templateRtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type NotificationsGetPlaceholderSourcesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemSimpleRtQuery?: { __typename?: 'SystemSimpleRtQueryConnection', items?: Array<{ __typename?: 'SystemSimpleRtQuery', rtId: any, columns: Array<string> } | null> | null } | null, systemNotificationNotificationTemplate?: { __typename?: 'SystemNotificationNotificationTemplateConnection', items?: Array<{ __typename?: 'SystemNotificationNotificationTemplate', rtId: any, subjectTemplate: string, bodyTemplate?: string | null } | null> | null } | null } | null };

export const NotificationsGetPlaceholderSourcesDocumentDto = gql`
    query NotificationsGetPlaceholderSources($queryRtId: OctoObjectId!, $templateRtId: OctoObjectId!) {
  runtime {
    systemSimpleRtQuery(rtId: $queryRtId) {
      items {
        rtId
        columns
      }
    }
    systemNotificationNotificationTemplate(rtId: $templateRtId) {
      items {
        rtId
        subjectTemplate
        bodyTemplate
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsGetPlaceholderSourcesDtoGQL extends Apollo.Query<NotificationsGetPlaceholderSourcesQueryDto, NotificationsGetPlaceholderSourcesQueryVariablesDto> {
    document = NotificationsGetPlaceholderSourcesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }