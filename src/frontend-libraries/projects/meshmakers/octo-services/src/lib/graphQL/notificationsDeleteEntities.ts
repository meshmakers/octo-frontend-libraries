import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type NotificationsDeleteEntitiesMutationVariablesDto = Types.Exact<{
  rtEntityIds: Array<Types.InputMaybe<Types.RtEntityIdDto>> | Types.InputMaybe<Types.RtEntityIdDto>;
  options?: Types.InputMaybe<Types.DeleteStrategiesDto>;
}>;


export type NotificationsDeleteEntitiesMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', runtimeEntities?: { __typename?: 'RtEntityMutations', delete?: boolean | null } | null } | null };

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