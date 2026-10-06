import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CockpitAdapterStatesQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type CockpitAdapterStatesQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemCommunicationAdapter?: { __typename?: 'SystemCommunicationAdapterConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemCommunicationAdapter', rtId: any, name?: string | null, communicationState: Types.SystemCommunicationCommunicationStateDto, communicationStateTimestamp?: any | null, deploymentState: Types.SystemCommunicationDeploymentStateDto, configurationState: Types.SystemCommunicationConfigurationStateDto, lifecycleState: Types.SystemCommunicationLifecycleStateDto } | null> | null } | null } | null };

export const CockpitAdapterStatesDocumentDto = gql`
    query cockpitAdapterStates($first: Int) {
  runtime {
    systemCommunicationAdapter(
      first: $first
      sortOrder: [{attributePath: "name", sortOrder: ASCENDING}]
    ) {
      totalCount
      items {
        rtId
        name
        communicationState
        communicationStateTimestamp
        deploymentState
        configurationState
        lifecycleState
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CockpitAdapterStatesDtoGQL extends Apollo.Query<CockpitAdapterStatesQueryDto, CockpitAdapterStatesQueryVariablesDto> {
    document = CockpitAdapterStatesDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }