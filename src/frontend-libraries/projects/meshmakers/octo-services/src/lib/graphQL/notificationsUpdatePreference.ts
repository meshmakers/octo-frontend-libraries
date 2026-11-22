import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsUpdatePreferenceMutationVariablesDto = Exact<{
  entities: Array<Types.SystemNotificationNotificationPreferenceInputUpdateDto | null | undefined> | Types.SystemNotificationNotificationPreferenceInputUpdateDto;
}>;


export type NotificationsUpdatePreferenceMutationDto = { runtime: { systemNotificationNotificationPreferences: { update: Array<{ rtId: any } | null> | null } | null } | null };

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