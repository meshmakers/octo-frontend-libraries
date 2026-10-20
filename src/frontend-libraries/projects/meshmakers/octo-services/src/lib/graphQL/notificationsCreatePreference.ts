import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsCreatePreferenceMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemNotificationNotificationPreferenceInputDto>> | Types.InputMaybe<Types.SystemNotificationNotificationPreferenceInputDto>;
}>;


export type NotificationsCreatePreferenceMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemNotificationNotificationPreferences?: { __typename?: 'SystemNotificationNotificationPreferenceMutations', create?: Array<{ __typename?: 'SystemNotificationNotificationPreference', rtId: any } | null> | null } | null } | null };

export const NotificationsCreatePreferenceDocumentDto = gql`
    mutation NotificationsCreatePreference($entities: [SystemNotificationNotificationPreferenceInput]!) {
  runtime {
    systemNotificationNotificationPreferences {
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
  export class NotificationsCreatePreferenceDtoGQL extends Apollo.Mutation<NotificationsCreatePreferenceMutationDto, NotificationsCreatePreferenceMutationVariablesDto> {
    document = NotificationsCreatePreferenceDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }