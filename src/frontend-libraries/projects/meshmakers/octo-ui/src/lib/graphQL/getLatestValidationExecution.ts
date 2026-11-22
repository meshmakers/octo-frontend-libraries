import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetLatestValidationExecutionQueryVariablesDto = Exact<{
  pipelineRtId: any;
  pipelineCkTypeId: string;
  executesRoleId: string;
  executionCkTypeId: string;
}>;


export type GetLatestValidationExecutionQueryDto = { runtime: { runtimeEntities: { items: Array<{ rtId: any, ckTypeId: any, associations: { executions: { items: Array<{ rtId: any, ckTypeId: any, attributes: { items: Array<{ attributeName: string | null, value: any } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const GetLatestValidationExecutionDocumentDto = gql`
    query getLatestValidationExecution($pipelineRtId: OctoObjectId!, $pipelineCkTypeId: String!, $executesRoleId: String!, $executionCkTypeId: String!) {
  runtime {
    runtimeEntities(rtId: $pipelineRtId, ckId: $pipelineCkTypeId) {
      items {
        rtId
        ckTypeId
        associations {
          executions: targets(
            roleId: $executesRoleId
            ckId: $executionCkTypeId
            direction: INBOUND
            first: 1
            sortOrder: [{attributePath: "CompletedAt", sortOrder: DESCENDING}]
          ) {
            items {
              rtId
              ckTypeId
              attributes(
                attributeNames: ["outputData", "completedAt"]
                resolveEnumValuesToNames: true
              ) {
                items {
                  attributeName
                  value
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
  export class GetLatestValidationExecutionDtoGQL extends Apollo.Query<GetLatestValidationExecutionQueryDto, GetLatestValidationExecutionQueryVariablesDto> {
    document = GetLatestValidationExecutionDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }