import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetDashboardsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
}>;


export type GetDashboardsQueryDto = { runtime: { systemUIDashboard: { totalCount: number | null, items: Array<{ rtId: any, ckTypeId: any, rtWellKnownName: string | null, name: string, description: string, columns: number, rowHeight: number, gap: number, rtCreationDateTime: any, rtChangedDateTime: any } | null> | null } | null } | null };

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