import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateDashboardMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiDashboardInputUpdateDto | null | undefined> | Types.SystemUiDashboardInputUpdateDto;
}>;


export type UpdateDashboardMutationDto = { runtime: { systemUIDashboards: { update: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtChangedDateTime: any } | null> | null } | null } | null };

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