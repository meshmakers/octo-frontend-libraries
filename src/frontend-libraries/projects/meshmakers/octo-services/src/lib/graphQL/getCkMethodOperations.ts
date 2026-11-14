import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkMethodOperationsQueryVariablesDto = Types.Exact<{
  operationId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  methodId?: Types.InputMaybe<Types.Scalars['String']['input']>;
  state?: Types.InputMaybe<Types.CkMethodOperationStateDto>;
  since?: Types.InputMaybe<Types.Scalars['DateTime']['input']>;
  allOwners?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  skip?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  take?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCkMethodOperationsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', operations?: { __typename?: 'CkMethodOperationConnection', totalCount: number, items: Array<{ __typename?: 'CkMethodOperation', operationId: string, methodId: string, invocationId: string, state: Types.CkMethodOperationStateDto, result?: any | null, acceptedAtUtc: any, startedAtUtc?: any | null, completedAtUtc?: any | null, expiresAtUtc?: any | null, progress?: { __typename?: 'CkMethodOperationProgress', percent?: number | null, stageCode?: string | null, parameters: Array<{ __typename?: 'CkMethodOperationParameter', name: string, value: string }> } | null, error?: { __typename?: 'CkMethodOperationError', code: string, parameters: Array<{ __typename?: 'CkMethodOperationParameter', name: string, value: string }>, details: Array<{ __typename?: 'CkMethodOperationErrorDetail', code: string, parameters: Array<{ __typename?: 'CkMethodOperationParameter', name: string, value: string }> }> } | null }> } | null } | null };

export const GetCkMethodOperationsDocumentDto = gql`
    query GetCkMethodOperations($operationId: ID, $methodId: String, $state: CkMethodOperationState, $since: DateTime, $allOwners: Boolean, $skip: Int, $take: Int) {
  runtime {
    operations(
      operationId: $operationId
      methodId: $methodId
      state: $state
      since: $since
      allOwners: $allOwners
      skip: $skip
      take: $take
    ) {
      totalCount
      items {
        operationId
        methodId
        invocationId
        state
        progress {
          percent
          stageCode
          parameters {
            name
            value
          }
        }
        result
        error {
          code
          parameters {
            name
            value
          }
          details {
            code
            parameters {
              name
              value
            }
          }
        }
        acceptedAtUtc
        startedAtUtc
        completedAtUtc
        expiresAtUtc
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkMethodOperationsDtoGQL extends Apollo.Query<GetCkMethodOperationsQueryDto, GetCkMethodOperationsQueryVariablesDto> {
    document = GetCkMethodOperationsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }