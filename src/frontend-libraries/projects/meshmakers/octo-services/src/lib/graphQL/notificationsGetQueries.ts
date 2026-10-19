import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetQueriesQueryVariablesDto = Types.Exact<{
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  searchFilter?: Types.InputMaybe<Types.SearchFilterDto>;
}>;


export type NotificationsGetQueriesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemSimpleRtQuery?: { __typename?: 'SystemSimpleRtQueryConnection', totalCount?: number | null, pageInfo?: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } | null, items?: Array<{ __typename?: 'SystemSimpleRtQuery', rtId: any, ckTypeId: any, name: string } | null> | null } | null } | null };

export const NotificationsGetQueriesDocumentDto = gql`
    query NotificationsGetQueries($after: String, $first: Int, $searchFilter: SearchFilter) {
  runtime {
    systemSimpleRtQuery(after: $after, first: $first, searchFilter: $searchFilter) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      items {
        rtId
        ckTypeId
        name
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsGetQueriesDtoGQL extends Apollo.Query<NotificationsGetQueriesQueryDto, NotificationsGetQueriesQueryVariablesDto> {
    document = NotificationsGetQueriesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }