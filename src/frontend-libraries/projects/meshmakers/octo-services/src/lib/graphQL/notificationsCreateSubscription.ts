import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsCreateSubscriptionMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemNotificationNotificationSubscriptionInputDto>> | Types.InputMaybe<Types.SystemNotificationNotificationSubscriptionInputDto>;
}>;


export type NotificationsCreateSubscriptionMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemNotificationNotificationSubscriptions?: { __typename?: 'SystemNotificationNotificationSubscriptionMutations', create?: Array<{ __typename?: 'SystemNotificationNotificationSubscription', rtId: any } | null> | null } | null } | null };

export const NotificationsCreateSubscriptionDocumentDto = gql`
    mutation NotificationsCreateSubscription($entities: [SystemNotificationNotificationSubscriptionInput]!) {
  runtime {
    systemNotificationNotificationSubscriptions {
      create(entities: $entities) {
        rtId
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsCreateSubscriptionDtoGQL extends Apollo.Mutation<NotificationsCreateSubscriptionMutationDto, NotificationsCreateSubscriptionMutationVariablesDto> {
    document = NotificationsCreateSubscriptionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }