import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type NotificationsDeleteEntitiesMutationVariablesDto = Exact<{
  rtEntityIds: Array<Types.RtEntityIdDto | null | undefined> | Types.RtEntityIdDto;
  options?: Types.DeleteStrategiesDto | null | undefined;
}>;


export type NotificationsDeleteEntitiesMutationDto = { runtime: { runtimeEntities: { delete: boolean | null } | null } | null };

export const NotificationsDeleteEntitiesDocumentDto = gql`
    mutation NotificationsDeleteEntities($rtEntityIds: [RtEntityId]!, $options: DeleteStrategies) {
  runtime {
    runtimeEntities {
      delete(entities: $rtEntityIds, options: $options)
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class NotificationsDeleteEntitiesDtoGQL extends Apollo.Mutation<NotificationsDeleteEntitiesMutationDto, NotificationsDeleteEntitiesMutationVariablesDto> {
    document = NotificationsDeleteEntitiesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }