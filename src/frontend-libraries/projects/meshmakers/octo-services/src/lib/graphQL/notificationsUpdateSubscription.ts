import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsUpdateSubscriptionMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemNotificationNotificationSubscriptionInputUpdateDto>> | Types.InputMaybe<Types.SystemNotificationNotificationSubscriptionInputUpdateDto>;
}>;


export type NotificationsUpdateSubscriptionMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemNotificationNotificationSubscriptions?: { __typename?: 'SystemNotificationNotificationSubscriptionMutations', update?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any } | null> | null } | null } | null };

export const NotificationsUpdateSubscriptionDocumentDto = gql`
    mutation NotificationsUpdateSubscription($entities: [SystemNotificationNotificationSubscriptionInputUpdate]!) {
  runtime {
    systemNotificationNotificationSubscriptions {
      update(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsUpdateSubscriptionDtoGQL extends Apollo.Mutation<NotificationsUpdateSubscriptionMutationDto, NotificationsUpdateSubscriptionMutationVariablesDto> {
    document = NotificationsUpdateSubscriptionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }