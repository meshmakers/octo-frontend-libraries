import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type ResolveSeriesQueryQueryVariablesDto = Exact<{
  input: Types.ResolveSeriesQueryInputDto;
}>;


export type ResolveSeriesQueryQueryDto = { streamData: { resolveSeriesQuery: { archiveRtId: any, effectiveBucketMs: any, points: number, reducingFunction: Types.CkRollupFunctionDto, signal: Types.SeriesResolutionSignalDto, actualPoints: number | null, diagnostic: string | null, finerRungAvailableFrom: any } | null } | null };

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
      finerRungAvailableFrom
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