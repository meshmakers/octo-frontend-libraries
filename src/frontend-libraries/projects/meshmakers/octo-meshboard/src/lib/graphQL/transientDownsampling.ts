import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type TransientDownsamplingQueryVariablesDto = Types.Exact<{
  archiveRtId: Types.Scalars['OctoObjectId']['input'];
  from: Types.Scalars['DateTime']['input'];
  to: Types.Scalars['DateTime']['input'];
  limit: Types.Scalars['Int']['input'];
  columnPaths: Array<Types.StreamDataQueryColumnInputDto> | Types.StreamDataQueryColumnInputDto;
  rtIds?: Types.InputMaybe<Array<Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>> | Types.InputMaybe<Types.Scalars['OctoObjectId']['input']>>;
  fieldFilter?: Types.InputMaybe<Array<Types.InputMaybe<Types.FieldFilterDto>> | Types.InputMaybe<Types.FieldFilterDto>>;
}>;


export type TransientDownsamplingQueryDto = { __typename?: 'OctoQuery', streamData?: { __typename?: 'StreamDataModelQuery', transientStreamDataQuery: { __typename?: 'StreamDataTransient', downsampling?: { __typename?: 'StreamDataTransientQueryDtoConnection', items?: Array<{ __typename?: 'StreamDataTransientQuery', rows?: { __typename?: 'StreamDataQueryRowDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'StreamDataQueryRow', rtId?: any | null, timestamp?: any | null, cells?: { __typename?: 'RtQueryCellDtoConnection', items?: Array<{ __typename?: 'RtQueryCell', attributePath: string, value?: any | null }> | null } | null }> | null } | null }> | null } | null } } | null };

export const TransientDownsamplingDocumentDto = gql`
    query transientDownsampling($archiveRtId: OctoObjectId!, $from: DateTime!, $to: DateTime!, $limit: Int!, $columnPaths: [StreamDataQueryColumnInput!]!, $rtIds: [OctoObjectId], $fieldFilter: [FieldFilter]) {
  streamData {
    transientStreamDataQuery {
      downsampling(
        archiveRtId: $archiveRtId
        from: $from
        to: $to
        limit: $limit
        columnPaths: $columnPaths
        rtIds: $rtIds
        fieldFilter: $fieldFilter
      ) {
        items {
          rows {
            totalCount
            items {
              rtId
              timestamp
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
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class TransientDownsamplingDtoGQL extends Apollo.Query<TransientDownsamplingQueryDto, TransientDownsamplingQueryVariablesDto> {
    document = TransientDownsamplingDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }