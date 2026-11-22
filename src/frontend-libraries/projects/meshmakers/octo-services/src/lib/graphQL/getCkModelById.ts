import type * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkModelByIdQueryVariablesDto = Exact<{
  model: any;
}>;


export type GetCkModelByIdQueryDto = { constructionKit: { models: { totalCount: number | null, items: Array<{ modelState: Types.ModelStateDto | null, id: { name: string, version: any, fullName: string, semanticVersionedFullName: string } } | null> | null } | null } | null };

export const GetCkModelByIdDocumentDto = gql`
    query getCkModelById($model: SimpleScalar!) {
  constructionKit {
    models(
      fieldFilter: [{attributePath: "modelState", operator: EQUALS, comparisonValue: "AVAILABLE"}, {attributePath: "modelId", operator: EQUALS, comparisonValue: $model}]
    ) {
      totalCount
      items {
        id {
          name
          version
          fullName
          semanticVersionedFullName
        }
        modelState
      }
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkModelByIdDtoGQL extends Apollo.Query<GetCkModelByIdQueryDto, GetCkModelByIdQueryVariablesDto> {
    document = GetCkModelByIdDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }