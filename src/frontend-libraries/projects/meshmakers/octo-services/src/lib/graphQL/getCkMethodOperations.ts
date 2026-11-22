import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkMethodOperationsQueryVariablesDto = Exact<{
  operationId?: string | number | null | undefined;
  methodId?: string | null | undefined;
  state?: Types.CkMethodOperationStateDto | null | undefined;
  since?: any;
  allOwners?: boolean | null | undefined;
  skip?: number | null | undefined;
  take?: number | null | undefined;
}>;


export type GetCkMethodOperationsQueryDto = { runtime: { operations: { totalCount: number, items: Array<{ operationId: string, methodId: string, invocationId: string, state: Types.CkMethodOperationStateDto, result: any, acceptedAtUtc: any, startedAtUtc: any, completedAtUtc: any, expiresAtUtc: any, progress: { percent: number | null, stageCode: string | null, parameters: Array<{ name: string, value: string }> } | null, error: { code: string, parameters: Array<{ name: string, value: string }>, details: Array<{ code: string, parameters: Array<{ name: string, value: string }> }> } | null }> } | null } | null };

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