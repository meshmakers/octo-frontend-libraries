import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateDashboardMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiDashboardInputDto>> | Types.InputMaybe<Types.SystemUiDashboardInputDto>;
}>;


export type CreateDashboardMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIDashboards?: { __typename?: 'SystemUIDashboardMutations', create?: Array<{ __typename?: 'SystemUIDashboard', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtCreationDateTime?: any | null } | null> | null } | null } | null };

export const CreateDashboardDocumentDto = gql`
    mutation createDashboard($entities: [SystemUIDashboardInput]!) {
  runtime {
    systemUIDashboards {
      create(entities: $entities) {
        rtId
        ckTypeId
        rtWellKnownName
        name
        description
        columns
        rowHeight
        gap
        rtCreationDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateDashboardDtoGQL extends Apollo.Mutation<CreateDashboardMutationDto, CreateDashboardMutationVariablesDto> {
    document = CreateDashboardDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }