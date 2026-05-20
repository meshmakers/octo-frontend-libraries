import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetLatestValidationExecutionQueryVariablesDto = Types.Exact<{
  pipelineRtId: Types.Scalars['OctoObjectId']['input'];
  pipelineCkTypeId: Types.Scalars['String']['input'];
  executesRoleId: Types.Scalars['String']['input'];
  executionCkTypeId: Types.Scalars['String']['input'];
}>;


export type GetLatestValidationExecutionQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeEntities?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, associations?: { __typename?: 'RtEntityGenericAssociation', executions?: { __typename?: 'RtEntityGenericDtoConnection', items?: Array<{ __typename?: 'RtEntity', rtId: any, ckTypeId: any, attributes?: { __typename?: 'RtEntityAttributeDtoConnection', items?: Array<{ __typename?: 'RtEntityAttribute', attributeName?: string | null, value?: any | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

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
              attributes(resolveEnumValuesToNames: true) {
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