import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsUpdatePreferenceMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemNotificationNotificationPreferenceInputUpdateDto>> | Types.InputMaybe<Types.SystemNotificationNotificationPreferenceInputUpdateDto>;
}>;


export type NotificationsUpdatePreferenceMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemNotificationNotificationPreferences?: { __typename?: 'SystemNotificationNotificationPreferenceMutations', update?: Array<{ __typename?: 'SystemNotificationNotificationPreference', rtId: any } | null> | null } | null } | null };

export const NotificationsUpdatePreferenceDocumentDto = gql`
    mutation NotificationsUpdatePreference($entities: [SystemNotificationNotificationPreferenceInputUpdate]!) {
  runtime {
    systemNotificationNotificationPreferences {
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
  export class NotificationsUpdatePreferenceDtoGQL extends Apollo.Mutation<NotificationsUpdatePreferenceMutationDto, NotificationsUpdatePreferenceMutationVariablesDto> {
    document = NotificationsUpdatePreferenceDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }