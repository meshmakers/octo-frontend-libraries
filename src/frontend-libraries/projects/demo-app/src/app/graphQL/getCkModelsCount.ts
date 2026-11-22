import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkModelsCountQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type GetCkModelsCountQueryDto = { constructionKit: { models: { totalCount: number | null } | null } | null };

export const GetCkModelsCountDocumentDto = gql`
    query getCkModelsCount {
  constructionKit {
    models {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkModelsCountDtoGQL extends Apollo.Query<GetCkModelsCountQueryDto, GetCkModelsCountQueryVariablesDto> {
    document = GetCkModelsCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }