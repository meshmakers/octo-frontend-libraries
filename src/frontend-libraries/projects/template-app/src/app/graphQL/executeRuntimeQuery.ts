import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type ExecuteRuntimeQueryQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type ExecuteRuntimeQueryQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeQuery?: { __typename?: 'RtQueryDtoConnection', items?: Array<{ __typename?: 'RtQuery', queryRtId: any, associatedCkTypeId: any, columns: Array<{ __typename?: 'RtQueryColumn', attributePath?: string | null, attributeValueType?: Types.AttributeValueTypeDto | null }>, rows?: { __typename?: 'RtQueryRowDtoConnection', totalCount?: number | null, items?: Array<
            | { __typename?: 'RtAggregationQueryRow', ckTypeId?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }
            | { __typename?: 'RtGroupingAggregationQueryRow', ckTypeId?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }
            | { __typename?: 'RtSimpleQueryRow', rtId?: any | null, ckTypeId?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }
          > | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } | null }> | null } | null } | null };

export const ExecuteRuntimeQueryDocumentDto = gql`
    query executeRuntimeQuery($rtId: OctoObjectId!, $after: String, $first: Int) {
  runtime {
    runtimeQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        columns {
          attributePath
          attributeValueType
        }
        rows(after: $after, first: $first) {
          totalCount
          items {
            ... on RtSimpleQueryRow {
              rtId
            }
            ckTypeId
            cells {
              totalCount
              items {
                attributePath
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
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
  export class ExecuteRuntimeQueryDtoGQL extends Apollo.Query<ExecuteRuntimeQueryQueryDto, ExecuteRuntimeQueryQueryVariablesDto> {
    document = ExecuteRuntimeQueryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }