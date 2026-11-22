import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type CockpitDataFlowExecutionsQueryVariablesDto = Exact<{
  first?: number | null | undefined;
}>;


export type CockpitDataFlowExecutionsQueryDto = { runtime: { systemCommunicationDataFlow: { totalCount: number | null, items: Array<{ rtId: any, children: { items: Array<
            | { rtId: any, statisticsForPipeline: { items: Array<{ lastExecutionAt: any, lastUpdatedAt: any, lastHourSuccessCount: number, lastHourFailureCount: number, last24HoursSuccessCount: number, last24HoursFailureCount: number, hourlyBuckets: Array<{ hourStartAt: any, successCount: number, failureCount: number }> | null } | null> | null } | null, executedPipeline: { items: Array<{ startedAt: any, status: Types.SystemCommunicationPipelineExecutionStatusDto } | null> | null } | null }
            | Record<PropertyKey, never>
           | null> | null } | null } | null> | null } | null } | null };

export const CockpitDataFlowExecutionsDocumentDto = gql`
    query cockpitDataFlowExecutions($first: Int) {
  runtime {
    systemCommunicationDataFlow(first: $first) {
      totalCount
      items {
        rtId
        children(ckTypeIds: ["System.Communication/Pipeline"]) {
          items {
            ... on SystemCommunicationPipeline {
              rtId
              statisticsForPipeline(
                ckTypeIds: ["System.Communication/PipelineStatistics"]
                first: 1
              ) {
                items {
                  ... on SystemCommunicationPipelineStatistics {
                    lastExecutionAt
                    lastUpdatedAt
                    lastHourSuccessCount
                    lastHourFailureCount
                    last24HoursSuccessCount
                    last24HoursFailureCount
                    hourlyBuckets {
                      hourStartAt
                      successCount
                      failureCount
                    }
                  }
                }
              }
              executedPipeline(
                ckTypeIds: ["System.Communication/PipelineExecution"]
                first: 1
                sortOrder: [{attributePath: "startedAt", sortOrder: DESCENDING}]
              ) {
                items {
                  ... on SystemCommunicationPipelineExecution {
                    startedAt
                    status
                  }
                }
              }
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
  export class CockpitDataFlowExecutionsDtoGQL extends Apollo.Query<CockpitDataFlowExecutionsQueryDto, CockpitDataFlowExecutionsQueryVariablesDto> {
    document = CockpitDataFlowExecutionsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }