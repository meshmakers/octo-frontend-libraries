import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkModelsWithStateQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type GetCkModelsWithStateQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', models?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null, items?: Array<{ __typename?: 'CkModel', modelState?: Types.ModelStateDto | null, id: { __typename?: 'CkModelId', name: string, version: any, fullName: string, semanticVersionedFullName: string } } | null> | null } | null } | null };

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