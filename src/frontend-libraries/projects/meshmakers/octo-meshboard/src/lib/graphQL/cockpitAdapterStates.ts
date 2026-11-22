import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CockpitAdapterStatesQueryVariablesDto = Exact<{
  first?: number | null | undefined;
}>;


export type CockpitAdapterStatesQueryDto = { runtime: { systemCommunicationAdapter: { totalCount: number | null, items: Array<{ rtId: any, name: string | null, communicationState: Types.SystemCommunicationCommunicationStateDto, communicationStateTimestamp: any, deploymentState: Types.SystemCommunicationDeploymentStateDto, configurationState: Types.SystemCommunicationConfigurationStateDto, lifecycleState: Types.SystemCommunicationLifecycleStateDto } | null> | null } | null } | null };

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