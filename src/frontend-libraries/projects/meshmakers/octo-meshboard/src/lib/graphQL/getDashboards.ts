import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetDashboardsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetDashboardsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemUIDashboard?: { __typename?: 'SystemUIDashboardConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemUIDashboard', rtId: any, ckTypeId: any, rtWellKnownName?: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null } | null> | null } | null } | null };

export const GetDashboardsDocumentDto = gql`
    query getDashboards($first: Int) {
  runtime {
    systemUIDashboard(first: $first) {
      totalCount
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
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetDashboardsDtoGQL extends Apollo.Query<GetDashboardsQueryDto, GetDashboardsQueryVariablesDto> {
    document = GetDashboardsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }