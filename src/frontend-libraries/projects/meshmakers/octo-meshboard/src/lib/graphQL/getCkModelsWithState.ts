import type * as Types from '@meshmakers/octo-services';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type GetCkModelsWithStateQueryVariablesDto = Exact<{ [key: string]: never; }>;


export type GetCkModelsWithStateQueryDto = { constructionKit: { models: { totalCount: number | null, items: Array<{ modelState: Types.ModelStateDto | null, id: { name: string, version: any, fullName: string, semanticVersionedFullName: string } } | null> | null } | null } | null };

export const GetCkModelsWithStateDocumentDto = gql`
    query getCkModelsWithState {
  constructionKit {
    models {
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
  export class GetCkModelsWithStateDtoGQL extends Apollo.Query<GetCkModelsWithStateQueryDto, GetCkModelsWithStateQueryVariablesDto> {
    document = GetCkModelsWithStateDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }