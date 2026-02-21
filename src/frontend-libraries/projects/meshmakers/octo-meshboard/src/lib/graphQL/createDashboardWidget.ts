import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CreateDashboardWidgetMutationVariablesDto = Types.Exact<{
  entities: Array<Types.InputMaybe<Types.SystemUiDashboardWidgetInputDto>> | Types.InputMaybe<Types.SystemUiDashboardWidgetInputDto>;
}>;


export type CreateDashboardWidgetMutationDto = { __typename?: 'OctoMutation', runtime?: { __typename?: 'Runtime', systemUIDashboardWidgets?: { __typename?: 'SystemUIDashboardWidgetMutations', create?: Array<{ __typename?: 'SystemUIDashboardWidget', rtId: any, ckTypeId: any, name: string, type: string, col: number, row: number, colSpan: number, rowSpan: number, dataSourceType: string, dataSourceCkTypeId?: string | null, dataSourceRtId?: string | null, config: string, rtCreationDateTime?: any | null } | null> | null } | null } | null };

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