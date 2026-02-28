import * as Types from './globalTypes';

import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type GetCkAttributesCountQueryVariablesDto = Types.Exact<{ [key: string]: never; }>;


export type GetCkAttributesCountQueryDto = { __typename?: 'OctoQuery', constructionKit?: { __typename?: 'ConstructionKitQuery', attributes?: { __typename?: 'CkAttributeDtoConnection', totalCount?: number | null } | null } | null };

export const GetCkAttributesCountDocumentDto = gql`
    query getCkAttributesCount {
  constructionKit {
    attributes {
      totalCount
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class GetCkAttributesCountDtoGQL extends Apollo.Query<GetCkAttributesCountQueryDto, GetCkAttributesCountQueryVariablesDto> {
    document = GetCkAttributesCountDocumentDto;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }