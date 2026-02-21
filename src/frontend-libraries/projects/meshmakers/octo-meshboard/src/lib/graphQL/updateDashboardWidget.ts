import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type UpdateDashboardWidgetMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiDashboardWidgetInputUpdateDto>> | Types.InputMaybe<Types.SystemUiDashboardWidgetInputUpdateDto>;
}>;


export type UpdateDashboardWidgetMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIDashboardWidgets?: { __typename?: 'SystemUIDashboardWidgetMutations', update?: Array<{ __typename?: 'SystemUIDashboardWidget', rtId: any, ckTypeId: any, name: string, type: string, col: number, row: number, colSpan: number, rowSpan: number, dataSourceType: string, dataSourceCkTypeId?: string | null, dataSourceRtId?: string | null, config: string, rtChangedDateTime?: any | null } | null> | null } | null } | null };

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