import * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type CockpitDataFlowExecutionsQueryVariablesDto = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type CockpitDataFlowExecutionsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', systemCommunicationDataFlow?: { __typename?: 'SystemCommunicationDataFlowConnection', totalCount?: number | null, items?: Array<{ __typename?: 'SystemCommunicationDataFlow', rtId: any, children?: { __typename?: 'SystemCommunicationPipeline_ChildrenUnionConnection', items?: Array<
            | { __typename?: 'SystemCommunicationPipeline', rtId: any, statisticsForPipeline?: { __typename?: 'SystemCommunicationPipelineStatistics_StatisticsForPipelineUnionConnection', items?: Array<{ __typename?: 'SystemCommunicationPipelineStatistics', lastExecutionAt?: any | null, lastHourSuccessCount: number, lastHourFailureCount: number, last24HoursSuccessCount: number, last24HoursFailureCount: number, hourlyBuckets?: Array<{ __typename?: 'SystemCommunicationPipelineStatisticsHourBucket', hourStartAt: any, successCount: number, failureCount: number }> | null } | null> | null } | null, executedPipeline?: { __typename?: 'SystemCommunicationPipelineExecution_ExecutedPipelineUnionConnection', items?: Array<{ __typename?: 'SystemCommunicationPipelineExecution', startedAt: any, status: Types.SystemCommunicationPipelineExecutionStatusDto } | null> | null } | null }
            | { __typename?: 'SystemCommunicationPipelineTrigger' }
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