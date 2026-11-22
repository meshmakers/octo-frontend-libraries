import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CreateDashboardWidgetMutationVariablesDto = Exact<{
  entities: Array<Types.SystemUiDashboardWidgetInputDto | null | undefined> | Types.SystemUiDashboardWidgetInputDto;
}>;


export type CreateDashboardWidgetMutationDto = { runtime: { systemUIDashboardWidgets: { create: Array<{ rtId: any, ckTypeId: any, name: string, type: string, col: number, row: number, colSpan: number, rowSpan: number, dataSourceType: string, dataSourceCkTypeId: string | null, dataSourceRtId: string | null, config: string, rtCreationDateTime: any } | null> | null } | null } | null };

export const CreateDashboardWidgetDocumentDto = gql`
    mutation createDashboardWidget($entities: [SystemUIDashboardWidgetInput]!) {
  runtime {
    systemUIDashboardWidgets {
      create(entities: $entities) {
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
        rtCreationDateTime
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateDashboardWidgetDtoGQL extends Apollo.Mutation<CreateDashboardWidgetMutationDto, CreateDashboardWidgetMutationVariablesDto> {
    document = CreateDashboardWidgetDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }