import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CockpitUnregisteredPoolsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
}>;


export type CockpitUnregisteredPoolsQueryDto = { runtime: { systemCommunicationDeploymentSite: { totalCount: number | null, items: Array<{ rtId: any, name: string | null } | null> | null } | null } | null };

export const CockpitUnregisteredPoolsDocumentDto = gql`
    query cockpitUnregisteredPools($first: Int) {
  runtime {
    systemCommunicationDeploymentSite(
      first: $first
      fieldFilter: [{attributePath: "communicationState", operator: EQUALS, comparisonValue: "UNREGISTERED"}]
      sortOrder: [{attributePath: "name", sortOrder: ASCENDING}]
    ) {
      totalCount
      items {
        rtId
        name
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CockpitUnregisteredPoolsDtoGQL extends Apollo.Query<CockpitUnregisteredPoolsQueryDto, CockpitUnregisteredPoolsQueryVariablesDto> {
    document = CockpitUnregisteredPoolsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }