import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateDashboardMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiDashboardInputDto | null | undefined> | Types.SystemUiDashboardInputDto;
}>;


export type CreateDashboardMutationDto = { runtime: { systemUIDashboards: { create: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtCreationDateTime: any } | null> | null } | null } | null };

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