import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CockpitUnregisteredPoolsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type CockpitUnregisteredPoolsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemCommunicationPool?: { __typename?: 'SystemCommunicationPoolConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemCommunicationPool', rtId: any, name?: string | null } | null> | null } | null } | null };

export const CockpitUnregisteredPoolsDocumentDto = gql`
    query cockpitUnregisteredPools($first: Int) {
  runtime {
    systemCommunicationPool(
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