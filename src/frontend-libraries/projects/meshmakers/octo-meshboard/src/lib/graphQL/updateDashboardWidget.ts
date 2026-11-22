import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type UpdateDashboardWidgetMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiDashboardWidgetInputUpdateDto | null | undefined> | Types.SystemUiDashboardWidgetInputUpdateDto;
}>;


export type UpdateDashboardWidgetMutationDto = { runtime: { systemUIDashboardWidgets: { update: Array<{ rtId: any, ckTypeId: any, name: string, type: string, col: number, row: number, colSpan: number, rowSpan: number, dataSourceType: string, dataSourceCkTypeId: string | null, dataSourceRtId: string | null, config: string, rtChangedDateTime: any } | null> | null } | null } | null };

export const UpdateDashboardWidgetDocumentDto = gql`
    mutation updateDashboardWidget($entities: [SystemUIDashboardWidgetInputUpdate]!) {
  runtime {
    systemUIDashboardWidgets {
      update(entities: $entities) {
        rtId
        ckTypeId
        name
        type
        col
        row
        colSpan
        rowSpan
        dataSourceType
        dataSourceCkTypeId
        dataSourceRtId
        config
        rtChangedDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateDashboardWidgetDtoGQL extends Apollo.Mutation<UpdateDashboardWidgetMutationDto, UpdateDashboardWidgetMutationVariablesDto> {
    document = UpdateDashboardWidgetDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }