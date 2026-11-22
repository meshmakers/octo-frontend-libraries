import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetRuntimeQueryColumnsQueryVariablesDto = Exact<{
  rtId: any;
}>;


export type GetRuntimeQueryColumnsQueryDto = { runtime: { runtimeQuery: { items: Array<{ queryRtId: any, associatedCkTypeId: any, columns: Array<{ attributePath: string | null, attributeValueType: Types.AttributeValueTypeDto | null, aggregationType: Types.AggregationTypesDto | null }> }> | null } | null } | null };

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