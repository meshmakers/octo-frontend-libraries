import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetRuntimeQueryColumnsQueryVariablesDto = Types.Exact<{
  rtId: Types.Scalars['OctoObjectId']['input'];
}>;


export type GetRuntimeQueryColumnsQueryDto = { __typename?: 'OctoQuery', runtime?: { __typename?: 'RuntimeModelQuery', runtimeQuery?: { __typename?: 'RtQueryDtoConnection', items?: Array<{ __typename?: 'RtQuery', queryRtId: any, associatedCkTypeId: any, columns: Array<{ __typename?: 'RtQueryColumn', attributePath?: string | null, attributeValueType?: Types.AttributeValueTypeDto | null, aggregationType?: Types.AggregationTypesDto | null }> }> | null } | null } | null };

export const GetRuntimeQueryColumnsDocumentDto = gql`
    query getRuntimeQueryColumns($rtId: OctoObjectId!) {
  runtime {
    runtimeQuery(rtId: $rtId) {
      items {
        queryRtId
        associatedCkTypeId
        columns {
          attributePath
          attributeValueType
          aggregationType
        }
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetRuntimeQueryColumnsDtoGQL extends Apollo.Query<GetRuntimeQueryColumnsQueryDto, GetRuntimeQueryColumnsQueryVariablesDto> {
    document = GetRuntimeQueryColumnsDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }