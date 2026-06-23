import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type ExecuteStreamDataQueryQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
  arg?: Types.InputMaybe<Types.StreamDataArgumentsDto>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  sortOrder?: Types.InputMaybe<Array<Types.InputMaybe<Types.SortDto>> | Types.InputMaybe<Types.SortDto>>;
  fieldFilter?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
}>;


export type ExecuteStreamDataQueryQueryDto = { __typename?: 'OctoQuery', streamData?: { __typename?: 'StreamDataModelQuery', streamDataQuery?: { __typename?: 'StreamDataQueryDtoConnection', items?: Array<{ __typename?: 'StreamDataQuery', queryRtId: any, associatedCkTypeId: any, columns: Array<{ __typename?: 'RtQueryColumn', attributePath?: string | null, attributeValueType?: Types.AttributeValueTypeDto | null, aggregationType?: Types.AggregationTypesDto | null }>, rows?: { __typename?: 'StreamDataQueryRowDtoConnection', totalCount?: number | null, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null }, items?: Array<{ __typename?: 'StreamDataQueryRow', rtId?: any | null, ckTypeId?: any | null, timestamp?: any | null, rtWellKnownName?: string | null, rtCreationDateTime?: any | null, rtChangedDateTime?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }> | null } | null }> | null } | null } | null };

export const ExecuteStreamDataQueryDocumentDto = gql`
    query executeStreamDataQuery($rtId: OctoObjectId!, $arg: StreamDataArguments, $first: Int, $after: String, $sortOrder: [Sort], $fieldFilter: [FieldFilter]) {
  streamData {
    streamDataQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        columns {
          attributePath
          attributeValueType
          aggregationType
        }
        rows(
          arg: $arg
          first: $first
          after: $after
          sortOrder: $sortOrder
          fieldFilter: $fieldFilter
        ) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          items {
            rtId
            ckTypeId
            timestamp
            rtWellKnownName
            rtCreationDateTime
            rtChangedDateTime
            cells {
              items {
                attributePath
                value
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
  export class ExecuteStreamDataQueryDtoGQL extends Apollo.Query<ExecuteStreamDataQueryQueryDto, ExecuteStreamDataQueryQueryVariablesDto> {
    document = ExecuteStreamDataQueryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }