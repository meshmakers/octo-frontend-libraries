import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateDashboardMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiDashboardInputUpdateDto>> | Types.InputMaybe<Types.SystemUiDashboardInputUpdateDto>;
}>;


export type UpdateDashboardMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIDashboards?: { __typename?: 'SystemUIDashboardMutations', update?: Array<{ __typename?: 'SystemUIDashboard', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const UpdateDashboardDocumentDto = gql`
    mutation updateDashboard($entities: [SystemUIDashboardInputUpdate]!) {
  runtime {
    systemUIDashboards {
      update(entities: $entities) {
        rtId
        ckTypeId
        rtWellKnownName
        name
        description
        columns
        rowHeight
        gap
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateDashboardDtoGQL extends Apollo.Mutation<UpdateDashboardMutationDto, UpdateDashboardMutationVariablesDto> {
    document = UpdateDashboardDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }