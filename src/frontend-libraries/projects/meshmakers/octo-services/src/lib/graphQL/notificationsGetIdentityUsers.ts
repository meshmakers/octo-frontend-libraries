import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsGetIdentityUsersQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type NotificationsGetIdentityUsersQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemIdentityUser?: { __typename?: 'SystemIdentityUserConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemIdentityUser', rtId: any, userName?: string | null, firstName?: string | null, lastName?: string | null, email?: string | null } | null> | null } | null } | null };

export const NotificationsGetIdentityUsersDocumentDto = gql`
    query notificationsGetIdentityUsers($first: Int, $after: String) {
  runtime {
    systemIdentityUser(first: $first, after: $after) {
      totalCount
      items {
        rtId
        userName
        firstName
        lastName
        email
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsGetIdentityUsersDtoGQL extends Apollo.Query<NotificationsGetIdentityUsersQueryDto, NotificationsGetIdentityUsersQueryVariablesDto> {
    document = NotificationsGetIdentityUsersDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }