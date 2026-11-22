import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsCreatePreferenceMutationVariablesDto = Exact<{
  entities: Array<Types.SystemNotificationNotificationPreferenceInputDto | null | undefined> | Types.SystemNotificationNotificationPreferenceInputDto;
}>;


export type NotificationsCreatePreferenceMutationDto = { runtime: { systemNotificationNotificationPreferences: { create: Array<{ rtId: any } | null> | null } | null } | null };

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