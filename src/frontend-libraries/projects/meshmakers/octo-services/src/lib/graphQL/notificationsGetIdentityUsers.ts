import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsGetIdentityUsersQueryVariablesDto = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;


export type NotificationsGetIdentityUsersQueryDto = { runtime: { systemIdentityUser: { totalCount: number | null, items: Array<{ rtId: any, userName: string | null, firstName: string | null, lastName: string | null, email: string | null } | null> | null } | null } | null };

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