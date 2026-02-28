import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkTypesCountQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type GetCkTypesCountQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', types?: { __typename?: 'CkTypeDtoConnection', totalCount?: number | null } | null } | null };

export const GetCkTypesCountDocumentDto = gql`
    query getCkTypesCount {
  constructionKit {
    types {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkTypesCountDtoGQL extends Apollo.Query<GetCkTypesCountQueryDto, GetCkTypesCountQueryVariablesDto> {
    document = GetCkTypesCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }