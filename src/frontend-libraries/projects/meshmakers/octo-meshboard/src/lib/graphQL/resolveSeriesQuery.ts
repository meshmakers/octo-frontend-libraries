import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type ResolveSeriesQueryQueryVariablesDto = Types.Exact<{
  input: Types.ResolveSeriesQueryInputDto;
}>;


export type ResolveSeriesQueryQueryDto = { __typename?: 'OctoQuery', streamData?: { __typename?: 'StreamDataModelQuery', resolveSeriesQuery?: { __typename?: 'ResolveSeriesQueryResult', archiveRtId: any, effectiveBucketMs: any, points: number, reducingFunction: Types.CkRollupFunctionDto, signal: Types.SeriesResolutionSignalDto, actualPoints?: number | null, diagnostic?: string | null } | null } | null };

export const ResolveSeriesQueryDocumentDto = gql`
    query resolveSeriesQuery($input: ResolveSeriesQueryInput!) {
  streamData {
    resolveSeriesQuery(input: $input) {
      archiveRtId
      effectiveBucketMs
      points
      reducingFunction
      signal
      actualPoints
      diagnostic
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class ResolveSeriesQueryDtoGQL extends Apollo.Query<ResolveSeriesQueryQueryDto, ResolveSeriesQueryQueryVariablesDto> {
    document = ResolveSeriesQueryDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }