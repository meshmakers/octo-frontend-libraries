import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkModelsCountQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type GetCkModelsCountQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', models?: { __typename?: 'CkModelDtoConnection', totalCount?: number | null } | null } | null };

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