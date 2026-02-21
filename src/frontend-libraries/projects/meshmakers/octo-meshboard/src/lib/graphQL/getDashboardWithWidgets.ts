import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetDashboardWithWidgetsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetDashboardWithWidgetsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUIDashboard?: { __typename?: 'SystemUIDashboardConnection', items?: Array<{ __typename?: 'SystemUIDashboard', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, children?: { __typename?: 'SystemUIDashboardWidget_ChildrenUnionConnection', items?: Array<{ __typename?: 'SystemUIDashboardWidget', rtId: any, ckTypeId: any, name: string, type: string, col: number, row: number, colSpan: number, rowSpan: number, dataSourceType: string, dataSourceCkTypeId?: string | null, dataSourceRtId?: string | null, config: string } | null> | null } | null } | null> | null } | null } | null };

export const GetDashboardWithWidgetsDocumentDto = gql`
    query getDashboardWithWidgets($rtId: OctoObjectId!) {
  runtime {
    systemUIDashboard(rtId: $rtId, first: 1) {
      items {
        rtId
        ckTypeId
        rtWellKnownName
        name
        description
        columns
        rowHeight
        gap
        rtCreationDateTime
        rtChangedDateTime
        children(first: 100, ckTypeIds: ["System.UI/DashboardWidget"]) {
          items {
            ... on SystemUIDashboardWidget {
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
            }
          }
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetDashboardWithWidgetsDtoGQL extends Apollo.Query<GetDashboardWithWidgetsQueryDto, GetDashboardWithWidgetsQueryVariablesDto> {
    document = GetDashboardWithWidgetsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }